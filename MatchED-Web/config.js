(function () {
  var url = '__MATCHED_API_URL__';
  if (url && !url.startsWith('__')) {
    window.MATCHED_API_URL = url;
  }
})();
