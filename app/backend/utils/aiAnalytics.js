function summarizeEngagement(records) {
  const total = records.length;
  return {
    total,
    averageSession: total ? Math.round(records.reduce((a,b)=>a+b.duration,0)/total) : 0,
    note: "Résumé généré automatiquement"
  };
}

module.exports = {
  summarizeEngagement,
};
