// Gestion des données utilisateur
class UserProfile {
    constructor() {
        this.userData = {
            prenom: 'Jean',
            nom: 'Dupont',
            email: 'jean.dupont@example.com',
            telephone: '+226 70 12 34 56',
            date_naissance: '1985-05-15',
            pays: 'Burkina Faso',
            role: 'Organisateur',
            is_premium: true,
            memberSince: '15/03/2023'
        };

        this.tontines = [];
        this.participants = [];
        this.requests = [];
        
        this.init();
    }

    init() {
        this.loadSampleData();
        this.setupEventListeners();
        this.updateUI();
    }

    loadSampleData() {
        // Données d'exemple - à remplacer par des appels API
        this.tontines = [
            { id: 1, name: "Tontine Familiale", amount: 5000, participants: 12, maxParticipants: 20, token: "TKN-ABC123XYZ", status: "active" },
            { id: 2, name: "Tontine Travail", amount: 10000, participants: 8, maxParticipants: 15, token: "TKN-DEF456UVW", status: "active" }
        ];

        this.participants = [
            { id: 1, name: "Marie Konaté", tontine: "Tontine Familiale", joined: "15/05/2023", status: "active" },
            { id: 2, name: "Paul Ouedraogo", tontine: "Tontine Familiale", joined: "20/05/2023", status: "active" }
        ];

        this.requests = [
            { id: 1, name: "Jean Kabore", tontine: "Tontine Familiale", date: "01/07/2023" }
        ];
    }

    setupEventListeners() {
        // Gestion du profil
        document.getElementById('editToggleBtn').addEventListener('click', () => this.toggleEditMode());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveProfile());
        document.getElementById('cancelBtn').addEventListener('click', () => this.cancelEdit());

        // Gestion des abonnements
        document.getElementById('upgradeBtn').addEventListener('click', () => this.openUpgradeModal());
        document.getElementById('cancelUpgradeBtn').addEventListener('click', () => this.closeUpgradeModal());
        document.getElementById('confirmUpgradeBtn').addEventListener('click', () => this.confirmUpgrade());

        // Gestion des tontines
        document.getElementById('createTontineBtn').addEventListener('click', () => this.openCreateTontineModal());
        document.getElementById('cancelCreateBtn').addEventListener('click', () => this.closeCreateTontineModal());
        document.getElementById('confirmCreateBtn').addEventListener('click', () => this.createTontine());

        // Gestion des modales
        document.getElementById('closeDetailsBtn').addEventListener('click', () => this.closeTontineDetailsModal());
        document.getElementById('acceptRequestBtn').addEventListener('click', () => this.acceptRequest());
        document.getElementById('refuseRequestBtn').addEventListener('click', () => this.showRefusalComment());
        document.getElementById('cancelDecisionBtn').addEventListener('click', () => this.closeRequestDecisionModal());

        // Gestion des onglets
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target));
        });

        // Sécurité
        document.getElementById('emailNotifications').addEventListener('change', (e) => this.toggleEmailNotifications(e.target.checked));
        document.getElementById('twoFactorAuth').addEventListener('change', (e) => this.toggleTwoFactorAuth(e.target.checked));
    }

    // Mise à jour de l'interface
    updateUI() {
        this.updateUserDisplay();
        this.populateTontines();
        this.populateParticipants();
        this.populateRequests();
        this.updateStats();
        this.updateNotificationCount();
    }

    updateUserDisplay() {
        document.getElementById('userName').textContent = `${this.userData.prenom} ${this.userData.nom}`;
        document.getElementById('userRole').textContent = this.userData.role;
        document.getElementById('userAvatar').textContent = 
            `${this.userData.prenom.charAt(0)}${this.userData.nom.charAt(0)}`.toUpperCase();
        
        // Mise à jour du statut premium
        if (this.userData.is_premium) {
            document.getElementById('userBadge').className = 'premium-badge';
            document.getElementById('userBadge').textContent = 'PREMIUM';
            document.getElementById('premiumStatus').style.display = 'block';
            document.getElementById('freeStatus').style.display = 'none';
        } else {
            document.getElementById('userBadge').className = 'free-badge';
            document.getElementById('userBadge').textContent = 'GRATUIT';
            document.getElementById('premiumStatus').style.display = 'none';
            document.getElementById('freeStatus').style.display = 'block';
        }
        
        // Remplissage des champs du formulaire
        document.getElementById('prenom').value = this.userData.prenom;
        document.getElementById('nom').value = this.userData.nom;
        document.getElementById('email').value = this.userData.email;
        document.getElementById('telephone').value = this.userData.telephone;
        document.getElementById('date_naissance').value = this.userData.date_naissance;
        document.getElementById('pays').value = this.userData.pays;
        document.getElementById('memberSince').textContent = this.userData.memberSince;
    }

    // Gestion du profil
    toggleEditMode() {
        const inputs = document.querySelectorAll('#profileForm input');
        const isEditing = !inputs[0].disabled;
        
        if (isEditing) {
            // Sauvegarder
            inputs.forEach(input => input.disabled = true);
            document.getElementById('formActions').style.display = 'none';
            document.getElementById('editToggleBtn').innerHTML = '<i class="fas fa-edit"></i> Modifier le Profil';
            this.showAlert('Profil mis à jour avec succès!', 'success');
        } else {
            // Activer l'édition
            inputs.forEach(input => input.disabled = false);
            document.getElementById('formActions').style.display = 'flex';
            document.getElementById('editToggleBtn').innerHTML = '<i class="fas fa-save"></i> Sauvegarder';
        }
    }

    saveProfile() {
        // Dans une vraie application, envoyer les données au serveur
        this.userData.prenom = document.getElementById('prenom').value;
        this.userData.nom = document.getElementById('nom').value;
        this.userData.telephone = document.getElementById('telephone').value;
        this.userData.date_naissance = document.getElementById('date_naissance').value;
        this.userData.pays = document.getElementById('pays').value;
        
        // Désactiver le formulaire
        const inputs = document.querySelectorAll('#profileForm input');
        inputs.forEach(input => input.disabled = true);
        document.getElementById('formActions').style.display = 'none';
        document.getElementById('editToggleBtn').innerHTML = '<i class="fas fa-edit"></i> Modifier le Profil';
        
        // Mettre à jour l'affichage
        this.updateUserDisplay();
        this.showAlert('Profil mis à jour avec succès!', 'success');
    }

    cancelEdit() {
        // Réinitialiser le formulaire
        this.updateUserDisplay();
        
        // Désactiver le formulaire
        const inputs = document.querySelectorAll('#profileForm input');
        inputs.forEach(input => input.disabled = true);
        document.getElementById('formActions').style.display = 'none';
        document.getElementById('editToggleBtn').innerHTML = '<i class="fas fa-edit"></i> Modifier le Profil';
    }

    // Gestion des tontines
    populateTontines() {
        const tontineList = document.getElementById('tontineList');
        tontineList.innerHTML = '';
        
        if (this.tontines.length === 0) {
            tontineList.innerHTML = '<li class="tontine-item" style="justify-content: center; color: var(--gray);">Aucune tontine créée</li>';
            return;
        }
        
        this.tontines.forEach(tontine => {
            const li = document.createElement('li');
            li.className = 'tontine-item';
            li.innerHTML = `
                <div class="tontine-info">
                    <h4>${tontine.name}</h4>
                    <p>${tontine.participants}/${tontine.maxParticipants} participants • ${tontine.amount.toLocaleString()} XOF</p>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-outline btn-sm" onclick="userProfile.showTontineDetails(${tontine.id})">
                        <i class="fas fa-eye"></i> Détails
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="userProfile.shareTontine(${tontine.id})">
                        <i class="fas fa-share-alt"></i> Partager
                    </button>
                </div>
            `;
            tontineList.appendChild(li);
        });
    }

    populateParticipants() {
        const participantList = document.getElementById('participantList');
        participantList.innerHTML = '';
        
        if (this.participants.length === 0) {
            participantList.innerHTML = '<li class="participant-item" style="justify-content: center; color: var(--gray);">Aucun participant</li>';
            return;
        }
        
        this.participants.forEach(participant => {
            const li = document.createElement('li');
            li.className = 'participant-item';
            li.innerHTML = `
                <div class="participant-info">
                    <h4>${participant.name}</h4>
                    <p>${participant.tontine} • Membre depuis ${participant.joined}</p>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-outline btn-sm" onclick="userProfile.contactParticipant(${participant.id})">
                        <i class="fas fa-envelope"></i> Contacter
                    </button>
                </div>
            `;
            participantList.appendChild(li);
        });
    }

    populateRequests() {
        const requestList = document.getElementById('requestList');
        requestList.innerHTML = '';
        
        if (this.requests.length === 0) {
            requestList.innerHTML = '<li class="participant-item" style="justify-content: center; color: var(--gray);">Aucune demande en attente</li>';
            return;
        }
        
        this.requests.forEach(request => {
            const li = document.createElement('li');
            li.className = 'participant-item';
            li.innerHTML = `
                <div class="participant-info">
                    <h4>${request.name}</h4>
                    <p>${request.tontine} • Demande le ${request.date}</p>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-success btn-sm" onclick="userProfile.showRequestDecision(${request.id})">
                        <i class="fas fa-check"></i> Accepter
                    </button>
                    <button class="btn btn-error btn-sm" onclick="userProfile.showRequestDecision(${request.id})">
                        <i class="fas fa-times"></i> Refuser
                    </button>
                </div>
            `;
            requestList.appendChild(li);
        });
    }

    updateStats() {
        document.getElementById('tontineCount').textContent = this.tontines.length;
        document.getElementById('participantCount').textContent = this.participants.length;
        document.getElementById('corridorCount').textContent = '3'; // Exemple
        document.getElementById('notificationCount').textContent = this.requests.length;
    }

    updateNotificationCount() {
        document.getElementById('notificationCount').textContent = this.requests.length;
    }

    // Modales
    openUpgradeModal() {
        document.getElementById('upgradeModal').classList.add('active');
    }

    closeUpgradeModal() {
        document.getElementById('upgradeModal').classList.remove('active');
    }

    confirmUpgrade() {
        // Dans une vraie application, traiter le paiement ici
        this.userData.is_premium = true;
        this.updateUserDisplay();
        this.closeUpgradeModal();
        this.showAlert('Félicitations! Vous êtes maintenant abonné Premium.', 'success');
    }

    openCreateTontineModal() {
        document.getElementById('createTontineModal').classList.add('active');
    }

    closeCreateTontineModal() {
        document.getElementById('createTontineModal').classList.remove('active');
        // Réinitialiser le formulaire
        document.getElementById('tontineName').value = '';
        document.getElementById('tontineAmount').value = '';
        document.getElementById('maxParticipants').value = '';
    }

    createTontine() {
        const name = document.getElementById('tontineName').value;
        const amount = document.getElementById('tontineAmount').value;
        const maxParticipants = document.getElementById('maxParticipants').value;
        
        if (!name || !amount || !maxParticipants) {
            this.showAlert('Veuillez remplir tous les champs obligatoires.', 'error');
            return;
        }
        
        const newTontine = {
            id: this.tontines.length + 1,
            name: name,
            amount: parseInt(amount),
            participants: 1, // L'organisateur est le premier participant
            maxParticipants: parseInt(maxParticipants),
            token: this.generateToken(),
            status: 'active'
        };
        
        this.tontines.push(newTontine);
        this.updateUI();
        this.closeCreateTontineModal();
        this.showAlert('Tontine créée avec succès!', 'success');
    }

    showTontineDetails(tontineId) {
        const tontine = this.tontines.find(t => t.id === tontineId);
        if (tontine) {
            const modal = document.getElementById('tontineDetailsModal');
            modal.querySelector('.modal-body').innerHTML = `
                <div class="form-group">
                    <label class="form-label">Nom de la Tontine</label>
                    <p style="padding: 10px; background: #f5f5f5; border-radius: 6px;">${tontine.name}</p>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Organisateur</label>
                    <p style="padding: 10px; background: #f5f5f5; border-radius: 6px;">${this.userData.prenom} ${this.userData.nom}</p>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Token d'Accès</label>
                    <div class="token-display">
                        <span>${tontine.token}</span>
                        <button class="copy-btn" data-token="${tontine.token}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Participants</label>
                    <p style="padding: 10px; background: #f5f5f5; border-radius: 6px;">${tontine.participants}/${tontine.maxParticipants}</p>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Montant par participant</label>
                    <p style="padding: 10px; background: #f5f5f5; border-radius: 6px;">${tontine.amount.toLocaleString()} XOF</p>
                </div>
            `;

            // Ajouter l'écouteur pour le bouton de copie
            const copyBtn = modal.querySelector('.copy-btn');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(tontine.token).then(() => {
                    this.showAlert('Token copié dans le presse-papier!', 'success');
                });
            });

            modal.classList.add('active');
        }
    }

    closeTontineDetailsModal() {
        document.getElementById('tontineDetailsModal').classList.remove('active');
    }

    // Gestion des demandes
    showRequestDecision(requestId) {
        this.currentRequestId = requestId;
        const request = this.requests.find(r => r.id === requestId);
        if (request) {
            const modal = document.getElementById('requestDecisionModal');
            modal.querySelector('.modal-body').innerHTML = `
                <p>Demande de participation de <strong>${request.name}</strong> à la tontine <strong>${request.tontine}</strong>.</p>
                <div class="form-group" id="refusalCommentGroup" style="display: none;">
                    <label class="form-label" for="refusalComment">Commentaire de refus</label>
                    <textarea id="refusalComment" class="form-control" rows="3" placeholder="Expliquez pourquoi vous refusez cette demande..."></textarea>
                </div>
            `;
            modal.classList.add('active');
        }
    }

    acceptRequest() {
        const requestIndex = this.requests.findIndex(r => r.id === this.currentRequestId);
        if (requestIndex !== -1) {
            const request = this.requests[requestIndex];
            
            // Ajouter aux participants
            this.participants.push({
                id: this.participants.length + 1,
                name: request.name,
                tontine: request.tontine,
                joined: new Date().toLocaleDateString('fr-FR'),
                status: 'active'
            });
            
            // Mettre à jour le nombre de participants dans la tontine
            const tontine = this.tontines.find(t => t.name === request.tontine);
            if (tontine) {
                tontine.participants++;
            }
            
            // Supprimer de la liste des demandes
            this.requests.splice(requestIndex, 1);
            
            // Mettre à jour l'interface
            this.updateUI();
            this.closeRequestDecisionModal();
            this.showAlert('Demande acceptée avec succès!', 'success');
        }
    }

    showRefusalComment() {
        document.getElementById('refusalCommentGroup').style.display = 'block';
        document.getElementById('refuseRequestBtn').style.display = 'none';
        document.getElementById('acceptRequestBtn').style.display = 'none';
        document.getElementById('cancelDecisionBtn').textContent = 'Confirmer le Refus';
        
        document.getElementById('cancelDecisionBtn').onclick = () => {
            const comment = document.getElementById('refusalComment').value;
            this.refuseRequest(comment);
        };
    }

    refuseRequest(comment) {
        const requestIndex = this.requests.findIndex(r => r.id === this.currentRequestId);
        if (requestIndex !== -1) {
            this.requests.splice(requestIndex, 1);
            this.updateUI();
        }
        
        this.closeRequestDecisionModal();
        this.showAlert('Demande refusée.', 'success');
    }

    closeRequestDecisionModal() {
        document.getElementById('requestDecisionModal').classList.remove('active');
        document.getElementById('refusalCommentGroup').style.display = 'none';
        document.getElementById('refuseRequestBtn').style.display = 'block';
        document.getElementById('acceptRequestBtn').style.display = 'block';
        document.getElementById('cancelDecisionBtn').textContent = 'Annuler';
        document.getElementById('cancelDecisionBtn').onclick = () => this.closeRequestDecisionModal();
    }

    // Utilitaires
    generateToken() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let token = 'TKN-';
        for (let i = 0; i < 9; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
    }

    switchTab(tabElement) {
        const tabId = tabElement.getAttribute('data-tab');
        
        // Mettre à jour l'onglet actif
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tabElement.classList.add('active');
        
        // Mettre à jour le contenu actif
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabId}-tab`).classList.add('active');
    }

    showAlert(message, type) {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.getElementById('alertContainer').appendChild(alert);
        
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }

    // Méthodes supplémentaires
    shareTontine(tontineId) {
        const tontine = this.tontines.find(t => t.id === tontineId);
        if (tontine) {
            navigator.clipboard.writeText(tontine.token).then(() => {
                this.showAlert('Token copié! Partagez-le avec vos participants.', 'success');
            });
        }
    }

    contactParticipant(participantId) {
        const participant = this.participants.find(p => p.id === participantId);
        if (participant) {
            this.showAlert(`Fonction de contact avec ${participant.name} bientôt disponible!`, 'success');
        }
    }

    toggleEmailNotifications(enabled) {
        this.showAlert(`Notifications email ${enabled ? 'activées' : 'désactivées'}`, 'success');
    }

    toggleTwoFactorAuth(enabled) {
        this.showAlert(`Validation en 2 étapes ${enabled ? 'activée' : 'désactivée'}`, 'success');
    }
}

// Initialisation
let userProfile;
document.addEventListener('DOMContentLoaded', function() {
    userProfile = new UserProfile();
});