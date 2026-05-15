import { Opportunity, EducationLevel, FundingType } from '@prisma/client';

interface UserProfile {
  education_level?: EducationLevel;
  age?: number;
  countries_of_interest?: string[];
  fields_of_interest?: string[];
  opportunity_types?: string[];
  funding_preferences?: FundingType[];
  deadline_window?: number; // days from now
  remote_preference?: boolean;
  language_preferences?: string[];
}

interface FitResult {
  fit_score: number;
  reasons: string[];
  warnings: string[];
  missing_data: string[];
}

/**
 * Calculates how well an opportunity matches a user profile.
 */
export function calculateOpportunityFit(
  userProfile: UserProfile,
  opportunity: Opportunity
): FitResult {
  let score = 0;
  let maxScore = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];

  // Education level match
  if (userProfile.education_level) {
    maxScore += 20;
    if (opportunity.education_levels.includes(userProfile.education_level)) {
      score += 20;
      reasons.push('Compatível com seu nível educacional');
    } else if (opportunity.education_levels.includes(EducationLevel.ANY)) {
      score += 15;
      reasons.push('Aberto para todos os níveis educacionais');
    } else {
      warnings.push('Nível educacional pode não ser compatível');
    }
  } else {
    missingData.push('education_level');
  }

  // Age match
  if (userProfile.age) {
    maxScore += 10;
    const { age_min, age_max } = opportunity;
    if (age_min && userProfile.age < age_min) {
      warnings.push('Idade abaixo do mínimo requerido');
    } else if (age_max && userProfile.age > age_max) {
      warnings.push('Idade acima do máximo requerido');
    } else {
      score += 10;
      reasons.push('Compatível com sua idade');
    }
  } else {
    missingData.push('age');
  }

  // Country match
  if (userProfile.countries_of_interest && userProfile.countries_of_interest.length > 0) {
    maxScore += 15;
    const userCountries = userProfile.countries_of_interest.map(c => c.toLowerCase());
    const oppCountries = opportunity.eligible_countries.map(c => c.toLowerCase());

    if (oppCountries.length === 0 || oppCountries.includes('international')) {
      score += 15;
      reasons.push('Aberta para estudantes internacionais');
    } else {
      const matches = userCountries.filter(c => oppCountries.includes(c));
      if (matches.length > 0) {
        score += 15;
        reasons.push('Aberta para seu país de interesse');
      } else {
        warnings.push('País de cidadania pode não ser elegível');
      }
    }
  } else {
    missingData.push('countries_of_interest');
  }

  // Fields of interest match
  if (userProfile.fields_of_interest && userProfile.fields_of_interest.length > 0) {
    maxScore += 15;
    const userFields = userProfile.fields_of_interest.map(f => f.toLowerCase());
    const oppFields = opportunity.fields_of_interest.map(f => f.toLowerCase());

    const matches = userFields.filter(f => oppFields.some(of => of.includes(f) || f.includes(of)));
    if (matches.length > 0) {
      score += 15;
      reasons.push('Dentro da sua área de interesse');
    } else if (oppFields.length === 0) {
      score += 7;
      reasons.push('Área de interesse não especificada');
    }
  } else {
    missingData.push('fields_of_interest');
  }

  // Opportunity type match
  if (userProfile.opportunity_types && userProfile.opportunity_types.length > 0) {
    maxScore += 10;
    if (userProfile.opportunity_types.includes(opportunity.opportunity_type)) {
      score += 10;
      reasons.push('Tipo de oportunidade compatível com suas preferências');
    }
  } else {
    missingData.push('opportunity_types');
  }

  // Funding match
  if (userProfile.funding_preferences && userProfile.funding_preferences.length > 0) {
    maxScore += 15;
    if (userProfile.funding_preferences.includes(opportunity.funding_type)) {
      score += 15;
      if (opportunity.funding_type === FundingType.FULLY_FUNDED) {
        reasons.push('Tem financiamento completo');
      } else if (opportunity.funding_type === FundingType.PARTIALLY_FUNDED) {
        reasons.push('Tem financiamento parcial');
      } else {
        reasons.push('Compatível com suas preferências de financiamento');
      }
    } else {
      warnings.push('Financiamento não está claro ou não compatível');
    }
  } else {
    missingData.push('funding_preferences');
  }

  // Deadline match
  if (userProfile.deadline_window) {
    maxScore += 10;
    if (opportunity.application_deadline) {
      const daysUntilDeadline = Math.ceil(
        (opportunity.application_deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDeadline <= userProfile.deadline_window && daysUntilDeadline > 0) {
        score += 10;
        reasons.push('Deadline ainda está aberto');
      } else if (daysUntilDeadline <= 0) {
        warnings.push('Deadline já passou');
      } else {
        warnings.push('Deadline próximo');
      }
    } else {
      warnings.push('Deadline não especificado');
    }
  } else {
    missingData.push('deadline_window');
  }

  // Remote/online preference
  if (userProfile.remote_preference !== undefined) {
    maxScore += 5;
    if (userProfile.remote_preference && (opportunity.is_remote || opportunity.is_online)) {
      score += 5;
      reasons.push('Disponível remotamente/online');
    } else if (!userProfile.remote_preference && !opportunity.is_remote && !opportunity.is_online) {
      score += 5;
      reasons.push('Oportunidade presencial');
    }
  }

  // Language match
  if (userProfile.language_preferences && userProfile.language_preferences.length > 0) {
    maxScore += 5;
    const userLangs = userProfile.language_preferences.map(l => l.toLowerCase());
    const oppLangs = opportunity.language_requirements.map(l => l.toLowerCase());

    if (oppLangs.length === 0) {
      score += 5;
      reasons.push('Requisitos de idioma não especificados');
    } else {
      const matches = userLangs.filter(l => oppLangs.includes(l));
      if (matches.length > 0) {
        score += 5;
        reasons.push('Compatível com seus idiomas');
      } else {
        warnings.push('Pode requerer idioma específico');
      }
    }
  }

  // Calculate final score
  const fitScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    fit_score: fitScore,
    reasons,
    warnings,
    missing_data: missingData,
  };
}