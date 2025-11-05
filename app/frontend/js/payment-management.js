class PaymentManager {
  constructor() {
    this.currentTontine = null;
    this.participants = [];
  }

  //Initialise le gestionnaire de paiements
  init() {
    this.setupEventListeners();
    this.loadPaymentStats();
  }

  //Configure les écouteurs d'événements
  setupEventListeners() {
    // Événement de changement de tontine
    document.getElementById('paymentTontineSelect')?.addEventListener('change', (e) => {
      this.currentTontine = e.target.value;
      if (this.currentTontine) {
        this.loadPaymentOverview(this.currentTontine);
      }
    });

    // Événement d'envoi de rappel
    document.getElementById('sendReminderBtn')?.addEventListener('click', () => {
      this.sendPaymentReminder();
    });
  }

  //Charge les statistiques de paiement
  async loadPaymentStats() {
    try {
      const response = await fetch('/api/organizer/payments/stats', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
      });

      if (response.ok) {
        const data = await response.json();
        this.renderPaymentStats(data.data);
      }
    } catch (err) {
      console.error('Erreur chargement stats paiement:', err);
    }
  }

  /**
   * Charge l'aperçu des paiements d'une tontine
   */
  async loadPaymentOverview(tontineId) {
    try {
      const response = await fetch(`/api/payments/overview/${tontineId}`, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
      });

      if (response.ok) {
        const data = await response.json();
        this.renderPaymentOverview(data.data);
      }
    } catch (err) {
      console.error('Erreur chargement aperçu paiement:', err);
    }
  }

  //Met à jour le statut de paiement d'un participant
  async updatePaymentStatus(participantId, status, amount = null) {
    try {
      const response = await fetch('/api/payments/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({
          tontineId: this.currentTontine,
          userId: participantId,
          status: status,
          amount: amount
        })
      });

      if (response.ok) {
        const data = await response.json();
        showNotification(data.message, 'success');
        this.loadPaymentOverview(this.currentTontine);
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (err) {
      console.error('Erreur mise à jour paiement:', err);
      showNotification(err.message, 'error');
    }
  }

  //Envoie un rappel de paiement
  async sendPaymentReminder() {
    if (!this.currentTontine) {
      showNotification('Veuillez sélectionner une tontine', 'error');
      return;
    }

    const message = prompt('Message de rappel (optionnel):') || '';

    try {
      const response = await fetch('/api/payments/reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({
          tontineId: this.currentTontine,
          message: message
        })
      });

      if (response.ok) {
        const data = await response.json();
        showNotification(data.message, 'success');
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (err) {
      console.error('Erreur envoi rappel:', err);
      showNotification(err.message, 'error');
    }
  }

  //Affiche les statistiques de paiement
  renderPaymentStats(stats) {
    const container = document.getElementById('paymentStats');
    if (!container) return;

    container.innerHTML = stats.map(stat => `
      <div class="col-md-4">
        <div class="card text-center">
          <div class="card-body">
            <h5 class="card-title">${stat.tontine_name}</h5>
            <div class="row text-center">
              <div class="col-4">
                <small>Total</small>
                <div class="h6 mb-0">${stat.total_participants}</div>
              </div>
              <div class="col-4">
                <small>Payés</small>
                <div class="h6 mb-0 text-success">${stat.completed_payments}</div>
              </div>
              <div class="col-4">
                <small>En attente</small>
                <div class="h6 mb-0 text-warning">${stat.pending_payments}</div>
              </div>
            </div>
            <div class="mt-2">
              <small>Collecté: ${stat.total_collected} XOF</small>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  //Affiche l'aperçu des paiements
  renderPaymentOverview(data) {
    const { stats, participants } = data;
    const container = document.getElementById('paymentOverview');
    
    if (!container) return;

    // Afficher les statistiques
    const statsHtml = `
      <div class="row mb-4">
        <div class="col-md-3">
          <div class="card bg-primary text-white">
            <div class="card-body text-center">
              <h6>Total Participants</h6>
              <h3>${stats.total_participants}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card bg-success text-white">
            <div class="card-body text-center">
              <h6>Paiements Terminés</h6>
              <h3>${stats.completed_payments}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card bg-warning text-white">
            <div class="card-body text-center">
              <h6>En Attente</h6>
              <h3>${stats.pending_payments}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card bg-info text-white">
            <div class="card-body text-center">
              <h6>Total Collecté</h6>
              <h3>${stats.total_collected} XOF</h3>
            </div>
          </div>
        </div>
      </div>
    `;

    // Afficher la liste des participants
    const participantsHtml = participants.map(participant => `
      <div class="border rounded p-3 mb-2 ${participant.payment_status === 'completed' ? 'payment-completed' : 'payment-pending'}">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <strong>${participant.prenom} ${participant.nom}</strong>
            <div class="small text-muted">${participant.email}</div>
            <div class="small">
              Statut: 
              <span class="badge ${participant.payment_status === 'completed' ? 'bg-success' : 'bg-warning'}">
                ${participant.payment_status === 'completed' ? 'Payé' : 'En attente'}
              </span>
              ${participant.amount ? ` • Montant: ${participant.amount} XOF` : ''}
              ${participant.payment_date ? ` • Le: ${new Date(participant.payment_date).toLocaleDateString()}` : ''}
            </div>
          </div>
          <div class="d-flex gap-1">
            ${participant.payment_status !== 'completed' ? `
              <button class="btn btn-success btn-sm" onclick="paymentManager.markAsPaid(${participant.id})">
                <i class="bi bi-check-lg"></i> Marquer payé
              </button>
            ` : `
              <button class="btn btn-warning btn-sm" onclick="paymentManager.markAsPending(${participant.id})">
                <i class="bi bi-clock"></i> Marquer en attente
              </button>
            `}
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = statsHtml + participantsHtml;
  }

  //Marque un participant comme ayant payé
  markAsPaid(participantId) {
    const amount = prompt('Montant payé (XOF):') || '';
    this.updatePaymentStatus(participantId, 'completed', parseFloat(amount));
  }

  //Marque un participant comme en attente de paiement
  markAsPending(participantId) {
    this.updatePaymentStatus(participantId, 'pending');
  }
}

// Initialisation globale
let paymentManager;

document.addEventListener('DOMContentLoaded', function() {
  paymentManager = new PaymentManager();
  paymentManager.init();
});

// Fonctions globales
window.paymentManager = paymentManager;