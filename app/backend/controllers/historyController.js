exports.getUserHistory = (req, res) => {
    const userId = req.params.userId;
    // récupérer l'historique de l'utilisateur depuis la base de données
    res.json({ message: `Historique pour l'utilisateur ${userId}` });
};
