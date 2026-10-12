/** Shared lazy loader for vendored browser libraries. */
(function (root) {
  const cache = new Map();
  function load(src, globalName, integrity) {
    if (root[globalName]) return Promise.resolve(root[globalName]);
    if (!cache.has(src)) {
      cache.set(src, new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src; script.async = true;
        if (integrity) { script.integrity = integrity; script.crossOrigin = 'anonymous'; }
        script.onload = () => root[globalName] ? resolve(root[globalName]) : reject(new Error(`${globalName} unavailable`));
        script.onerror = () => reject(new Error(`Could not load ${globalName}`));
        document.head.append(script);
      }));
    }
    return cache.get(src);
  }
  root.ATSExternalScript = Object.freeze({ load });
})(typeof self !== 'undefined' ? self : window);
