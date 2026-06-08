const TRACKING_FILL_STYLE_ID = 'rental-tracking-fill';
const TRACKING_FILL_SCRIPT_ID = 'rental-tracking-fill-js';

const TRACKING_FILL_CSS = `
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 100% !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  box-sizing: border-box !important;
  background: #ffffff !important;
}
*, *::before, *::after { box-sizing: border-box; }
center {
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  text-align: initial !important;
}
body > table,
body table,
body center > table,
body .container,
body #container,
body .main,
body #main,
body .content,
body #content,
body .wrapper,
body #wrapper,
body form > table {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  table-layout: fixed !important;
  border-collapse: collapse !important;
}
body table[width],
body table td[width],
body table th[width] {
  width: 100% !important;
}
body colgroup,
body col {
  width: auto !important;
}
body table tr > td,
body table tr > th {
  max-width: 100% !important;
}
body table tr > td:only-child,
body table tr > th:only-child {
  width: 100% !important;
  max-width: 100% !important;
}
body table td > table,
body table td > div,
body table td > center {
  width: 100% !important;
  max-width: 100% !important;
}
body iframe,
body frame,
body table iframe {
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  height: calc(100vh - 11rem) !important;
  min-height: 28rem !important;
  border: 0 !important;
}
div[id*="map"],
div[id*="Map"],
div[class*="map"],
div[class*="Map"],
.map,
#map,
#Map,
.gm-style,
.gm-style > div,
.gm-style > div > div {
  width: 100% !important;
  max-width: 100% !important;
  left: 0 !important;
  right: 0 !important;
}
div[id*="map"],
div[id*="Map"],
#map,
#Map,
.map {
  height: calc(100vh - 11rem) !important;
  min-height: 28rem !important;
}
body img {
  max-width: 100% !important;
  height: auto !important;
}
`;

const TRACKING_FILL_SCRIPT = `
(function () {
  var MAP_SELECTORS = '[id*="map"], [id*="Map"], .map, #map, #Map';

  function isMapNode(node) {
    if (!node || node.nodeType !== 1) return false;
    var id = (node.id || '').toLowerCase();
    var cls = (node.className || '').toString().toLowerCase();
    return id.indexOf('map') >= 0 || cls.indexOf('map') >= 0 || node.classList.contains('map');
  }

  function stretchAncestors(node) {
    var current = node;
    while (current && current !== document.documentElement) {
      current.style.width = '100%';
      current.style.maxWidth = '100%';
      current.style.minWidth = '0';
      if (current.removeAttribute) {
        current.removeAttribute('width');
        current.removeAttribute('height');
      }
      current = current.parentElement;
    }
  }

  function layoutTimelineAndMap(mapNode) {
    var mapCell = mapNode.closest ? mapNode.closest('td, th') : null;
    if (!mapCell || !mapCell.parentElement) return;

    var row = mapCell.parentElement;
    var cells = Array.prototype.slice.call(row.children || []);
    cells.forEach(function (cell) {
      if (cell === mapCell) {
        cell.style.width = '100%';
        cell.style.maxWidth = '100%';
        cell.style.verticalAlign = 'top';
      } else {
        cell.style.width = '30%';
        cell.style.maxWidth = '22rem';
        cell.style.verticalAlign = 'top';
      }
      cell.removeAttribute('width');
      cell.style.minWidth = '0';
    });

    var table = row.closest ? row.closest('table') : null;
    if (table) {
      table.removeAttribute('width');
      table.style.width = '100%';
      table.style.maxWidth = '100%';
      table.style.tableLayout = 'fixed';
    }
  }

  function triggerGoogleMapsResize() {
    if (!(window.google && window.google.maps && window.google.maps.event)) return;

    window.google.maps.event.trigger(window, 'resize');

    document.querySelectorAll(MAP_SELECTORS).forEach(function (node) {
      if (node && node.__gm && node.__gm.map) {
        window.google.maps.event.trigger(node.__gm.map, 'resize');
      }
    });

    if (window.map && typeof window.map === 'object') {
      window.google.maps.event.trigger(window.map, 'resize');
    }
  }

  function stretchTrackingReport() {
    try {
      var vh = window.innerHeight || document.documentElement.clientHeight || 720;
      var mapHeight = Math.max(448, vh - 176) + 'px';

      document.querySelectorAll('center').forEach(function (node) {
        node.style.display = 'block';
        node.style.width = '100%';
        node.style.maxWidth = '100%';
        node.style.margin = '0';
        node.style.textAlign = 'initial';
      });

      document.querySelectorAll('table').forEach(function (table) {
        table.removeAttribute('width');
        table.style.width = '100%';
        table.style.maxWidth = '100%';
        table.style.tableLayout = 'fixed';
        table.style.margin = '0';
      });

      document.querySelectorAll('colgroup, col').forEach(function (node) {
        node.removeAttribute('width');
        if (node.style) node.style.width = 'auto';
      });

      document.querySelectorAll('iframe').forEach(function (frame) {
        frame.style.width = '100%';
        frame.style.maxWidth = '100%';
        frame.style.height = mapHeight;
        frame.style.minHeight = mapHeight;
        frame.style.display = 'block';
      });

      var mapNodes = Array.prototype.slice.call(document.querySelectorAll(MAP_SELECTORS));
      if (!mapNodes.length) {
        document.querySelectorAll('div').forEach(function (node) {
          if (isMapNode(node)) mapNodes.push(node);
        });
      }

      mapNodes.forEach(function (node) {
        layoutTimelineAndMap(node);
        stretchAncestors(node);
        node.style.width = '100%';
        node.style.maxWidth = '100%';
        node.style.height = mapHeight;
        node.style.minHeight = mapHeight;
        node.style.display = 'block';
      });

      triggerGoogleMapsResize();
    } catch (e) {
      /* ignore */
    }
  }

  window.__rentalStretchTrackingReport = stretchTrackingReport;

  window.addEventListener('load', stretchTrackingReport);
  window.addEventListener('resize', stretchTrackingReport);

  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function () {
      stretchTrackingReport();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    setTimeout(function () { observer.disconnect(); }, 12000);
  }

  setTimeout(stretchTrackingReport, 100);
  setTimeout(stretchTrackingReport, 400);
  setTimeout(stretchTrackingReport, 1000);
  setTimeout(stretchTrackingReport, 2500);
})();
`;

function trackingViewportMeta(): string {
  return '<meta name="viewport" content="width=device-width, initial-scale=1" />';
}

function trackingFillStyleTag(): string {
  return `<style id="${TRACKING_FILL_STYLE_ID}">${TRACKING_FILL_CSS}</style>`;
}

function trackingFillScriptTag(): string {
  return `<script id="${TRACKING_FILL_SCRIPT_ID}">${TRACKING_FILL_SCRIPT}</script>`;
}

function injectTrackingFillAssets(html: string): string {
  const styleTag = trackingFillStyleTag();
  const viewport = trackingViewportMeta();
  const scriptTag = trackingFillScriptTag();

  let out = html;
  if (/<head[\s>]/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${viewport}${styleTag}`);
  } else if (/<html[\s>]/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, `<html$1><head>${viewport}${styleTag}</head>`);
  } else if (/<body[\s>]/i.test(out)) {
    out = out.replace(/<body([^>]*)>/i, `<body$1>${viewport}${styleTag}`);
  } else {
    out = `<!DOCTYPE html><html><head>${viewport}${styleTag}</head><body>${out}</body></html>`;
  }

  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${scriptTag}</body>`);
  } else {
    out += scriptTag;
  }

  return out;
}

/** Injects responsive fill CSS/JS into HTML returned by Tracking/GetApi (srcdoc reports). */
export function prepareTrackingIframeHtml(html: string): string {
  const trimmed = String(html ?? '').trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.includes(TRACKING_FILL_STYLE_ID)) {
    return trimmed;
  }
  return injectTrackingFillAssets(trimmed);
}

/** Wraps an external tracking URL so the nested document can use the full iframe viewport. */
export function wrapTrackingIframeUrl(url: string): string {
  const normalized = String(url ?? '').trim();
  if (!normalized) {
    return '';
  }
  const escaped = normalized
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
  return injectTrackingFillAssets(
    `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><iframe src="${escaped}" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></body></html>`,
  );
}
