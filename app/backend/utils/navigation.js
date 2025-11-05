function buildBreadcrumbs(parts = []) {
  return parts.map((p,i)=>({ name: p, href: "/" + parts.slice(0,i+1).join("/") }));
}

module.exports = {
  buildBreadcrumbs,
};
