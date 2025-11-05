const API_BASE = window.API_BASE_URL || "";
let currentUser = null;
let dashboardInitialized = false;

// Fonction utilitaire pour les appels API
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("mec_token");
  const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token,
    ...options.headers
  };

  try {
    const response = await fetch(API_BASE + endpoint, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erreur serveur" }));
      throw new Error(error.message || "Erreur API");
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur API fetch:', error);
    throw error;
  }
}

// Échappement HTML
function escapeHtml(s){ 
  if(!s) return ""; 
  return String(s).replace(/[&<>"']/g, m => ({ 
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' 
  })[m]); 
}

// Formatage monétaire
function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', { 
    style: 'currency', 
    currency: 'XOF',
    minimumFractionDigits: 0 
  }).format(amount || 0);
}

// Changement d'onglet
function showTab(tabId) {
  const tabElement = document.querySelector(`#participantTabs a[href="#${tabId}"]`);
  if (tabElement) {
    const tab = new bootstrap.Tab(tabElement);
    tab.show();
  }
}

// Gestionnaire d'erreurs amélioré
function handleError(context, error, userMessage = null) {
  console.error(`Erreur ${context}:`, error);
  
  // Gestion des erreurs d'authentification
  if (error.message.includes('token') || error.message.includes('authentification') || error.message.includes('401')) {
    localStorage.removeItem("mec_token");
    localStorage.removeItem("mec_role");
    window.location.href = "login.html";
    return;
  }
  
  const message = userMessage || error.message || `Erreur lors de ${context}`;
  showNotification(message, 'error');
}

// Système de notification amélioré
function showNotification(message, type = 'info') {
  // Créer une notification toast
  const toastContainer = document.getElementById('toastContainer') || createToastContainer();
  const toastId = 'toast-' + Date.now();
  
  const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  const bgClass = type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary';
  
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-bg-${bgClass} border-0" role="alert">
      <div class="d-flex">
        <div class="toast-body">
          ${icon} ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `;
  
  toastContainer.insertAdjacentHTML('beforeend', toastHtml);
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
  toast.show();
  
  // Nettoyer après fermeture
  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toastContainer';
  container.className = 'toast-container position-fixed top-0 end-0 p-3';
  container.style.zIndex = '9999';
  document.body.appendChild(container);
  return container;
}

// DASHBOARD PARTICIPANT ET FONCTIONS PRINCIPALES

// Initialisation Dashboard Participant
async function loadParticipantDashboard(){
  if (dashboardInitialized) return;
  
  try{
    // Vérifier le rôle
    const role = localStorage.getItem("mec_role");
    if (role !== "participant") {
      window.location.href = "login.html";
      return;
    }

    // Charger les données principales avec gestion d'erreur individuelle
    await Promise.allSettled([
      loadFinancialOverview().catch(err => handleError('financial overview', err)),
      loadRecentTransactions().catch(err => handleError('recent transactions', err)),
      loadTontinesSummary().catch(err => handleError('tontines summary', err)),
      loadAvailableTontines().catch(err => handleError('available tontines', err)),
      loadMyTontines().catch(err => handleError('my tontines', err)),
      loadNotifications().catch(err => handleError('notifications', err)),
      loadPaymentHistory().catch(err => handleError('payment history', err)),
      loadPaymentSummary().catch(err => handleError('payment summary', err))
    ]);

    dashboardInitialized = true;
    
  }catch(err){ 
    handleError('loadParticipantDashboard', err, 'Impossible de charger le dashboard. Réessayez.');
  }
}

// Gestion Financière
async function loadFinancialOverview(){
  try{
    const res = await apiFetch('/payments/user/history');
    const history = res.data;

    const totalPaid = history.payments?.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0) || 0;
    const totalReceived = history.distributions?.reduce((sum, distribution) => sum + parseFloat(distribution.amount || 0), 0) || 0;
    const netBalance = totalReceived - totalPaid;

    document.getElementById('netBalance').textContent = formatCurrency(netBalance);
    document.getElementById('totalPaid').textContent = formatCurrency(totalPaid);
    document.getElementById('totalReceived').textContent = formatCurrency(totalReceived);

    // Mettre à jour la couleur du solde net
    const netBalanceElement = document.getElementById('netBalance');
    if (netBalanceElement) {
      netBalanceElement.className = netBalance >= 0 ? 'balance-positive' : 'balance-warning';
    }

  }catch(err){
    handleError('loadFinancialOverview', err);
  }
}

async function loadRecentTransactions(){
  try{
    const res = await apiFetch('/payments/user/history');
    const history = res.data;

    const allTransactions = [
      ...(history.payments || []).map(p => ({ ...p, type: 'payment', date: p.payment_date })),
      ...(history.distributions || []).map(d => ({ ...d, type: 'distribution', date: d.distribution_date }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    renderRecentTransactions(allTransactions);
  }catch(err){
    handleError('loadRecentTransactions', err);
  }
}

function renderRecentTransactions(transactions){
  const container = document.getElementById('recentTransactions');
  if (!container) return;
  
  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="bi bi-receipt fs-1"></i>
        <div class="mt-2">Aucune transaction récente</div>
      </div>
    `;
    return;
  }

  container.innerHTML = transactions.map(trans => `
    <div class="transaction-item ${trans.type === 'payment' ? 'transaction-expense' : 'transaction-income'} border rounded p-3 mb-2">
      <div class="d-flex justify-content-between align-items-start">
        <div class="flex-grow-1">
          <div class="fw-bold">${escapeHtml(trans.tontine_name || 'N/A')}</div>
          <div class="small text-muted">
            ${trans.type === 'payment' ? 
              `Paiement à ${trans.organizer_prenom || ''} ${trans.organizer_nom || ''}` : 
              `Distribution de ${trans.distributor_prenom || ''} ${trans.distributor_nom || ''}`
            }
          </div>
          <div class="small text-muted">
            ${trans.date ? new Date(trans.date).toLocaleDateString('fr-FR') : 'Date inconnue'}
            ${trans.date ? new Date(trans.date).toLocaleTimeString('fr-FR') : ''}
          </div>
        </div>
        <div class="text-end">
          <div class="fw-bold ${trans.type === 'payment' ? 'text-danger' : 'text-success'}">
            ${trans.type === 'payment' ? '-' : '+'}${formatCurrency(trans.amount)}
          </div>
          <div class="small">
            <span class="badge ${trans.type === 'payment' ? 'bg-danger' : 'bg-success'}">
              ${trans.type === 'payment' ? 'Débit' : 'Crédit'}
            </span>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// Résumé des Tontines
async function loadTontinesSummary(){
  try{
    const res = await apiFetch('/participants/my-tontines');
    const myTontines = res.data || [];

    const container = document.getElementById('tontinesSummary');
    if (!container) return;
    
    if (myTontines.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-3">
          <i class="bi bi-piggy-bank fs-1"></i>
          <div class="mt-2">Aucune tontine</div>
          <small>Rejoignez une tontine pour commencer</small>
        </div>
      `;
      return;
    }

    const paidCount = myTontines.filter(t => t.payment_status === 'completed').length;
    const pendingCount = myTontines.filter(t => t.payment_status === 'pending').length;

    container.innerHTML = `
      <div class="text-center mb-3">
        <h3 class="text-primary">${myTontines.length}</h3>
        <div class="small text-muted">Tontines actives</div>
      </div>
      <div class="row text-center">
        <div class="col-6">
          <div class="card bg-light">
            <div class="card-body p-2">
              <div class="small text-muted">Payées</div>
              <h5 class="text-success mb-0">${paidCount}</h5>
            </div>
          </div>
        </div>
        <div class="col-6">
          <div class="card bg-light">
            <div class="card-body p-2">
              <div class="small text-muted">En attente</div>
              <h5 class="text-warning mb-0">${pendingCount}</h5>
            </div>
          </div>
        </div>
      </div>
      <div class="progress progress-small mt-3">
        <div class="progress-bar bg-success" style="width: ${myTontines.length > 0 ? (paidCount / myTontines.length) * 100 : 0}%"></div>
      </div>
      <div class="small text-muted text-center mt-1">
        ${paidCount}/${myTontines.length} tontines payées
      </div>
    `;

  }catch(err){
    handleError('loadTontinesSummary', err);
  }
}

// Gestion des Paiements
async function loadPaymentHistory(){
  try{
    const res = await apiFetch('/payments/user/history');
    const history = res.data;

    const allTransactions = [
      ...(history.payments || []).map(p => ({ ...p, type: 'payment' })),
      ...(history.distributions || []).map(d => ({ ...d, type: 'distribution' }))
    ].sort((a, b) => new Date(b.payment_date || b.distribution_date) - new Date(a.payment_date || a.distribution_date));

    const container = document.getElementById("paymentHistory");
    if (!container) return;
    
    if (allTransactions.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-4">Aucune transaction</div>';
      return;
    }

    container.innerHTML = allTransactions.map(trans => `
      <div class="transaction-item ${trans.type === 'payment' ? 'transaction-expense' : 'transaction-income'} border rounded p-3 mb-2">
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <div class="fw-bold">${escapeHtml(trans.tontine_name || 'N/A')}</div>
            <div class="small text-muted">
              ${trans.type === 'payment' ? 
                `Paiement à ${trans.organizer_prenom || ''} ${trans.organizer_nom || ''}` : 
                `Distribution de ${trans.distributor_prenom || ''} ${trans.distributor_nom || ''}`
              }
            </div>
            <div class="small text-muted">
              ${new Date(trans.payment_date || trans.distribution_date).toLocaleDateString('fr-FR')}
              ${new Date(trans.payment_date || trans.distribution_date).toLocaleTimeString('fr-FR')}
            </div>
          </div>
          <div class="text-end">
            <div class="fw-bold ${trans.type === 'payment' ? 'text-danger' : 'text-success'}">
              ${trans.type === 'payment' ? '-' : '+'}${formatCurrency(trans.amount)}
            </div>
            <div class="small">
              <span class="badge ${trans.type === 'payment' ? 'bg-danger' : 'bg-success'}">
                ${trans.type === 'payment' ? 'Débit' : 'Crédit'}
              </span>
            </div>
          </div>
        </div>
      </div>
    `).join('');
    
  }catch(err){
    handleError('loadPaymentHistory', err);
  }
}

async function loadPaymentSummary(){
  try{
    const res = await apiFetch('/payments/user/history');
    const history = res.data;

    const totalPaid = history.payments?.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0) || 0;
    const totalReceived = history.distributions?.reduce((sum, distribution) => sum + parseFloat(distribution.amount || 0), 0) || 0;
    const netBalance = totalReceived - totalPaid;

    const container = document.getElementById("paymentSummary");
    if (!container) return;
    
    container.innerHTML = `
      <div class="row text-center">
        <div class="col-6">
          <div class="card bg-light">
            <div class="card-body p-2">
              <div class="small text-muted">Total Payé</div>
              <h5 class="text-danger">${formatCurrency(totalPaid)}</h5>
            </div>
          </div>
        </div>
        <div class="col-6">
          <div class="card bg-light">
            <div class="card-body p-2">
              <div class="small text-muted">Total Reçu</div>
              <h5 class="text-success">${formatCurrency(totalReceived)}</h5>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-3 p-2 bg-light rounded text-center">
        <div class="small text-muted">Solde Net</div>
        <h4 class="${netBalance >= 0 ? 'balance-positive' : 'balance-warning'}">
          ${netBalance >= 0 ? '+' : ''}${formatCurrency(netBalance)}
        </h4>
      </div>
      <div class="mt-2 small text-muted text-center">
        <i class="bi bi-info-circle"></i> 
        Solde = Total reçu - Total payé
      </div>
    `;
    
  }catch(err){
    handleError('loadPaymentSummary', err);
  }
}

// Paiement de Cotisation
function initializePaymentForm() {
  const paymentForm = document.getElementById("paymentForm");
  if (!paymentForm) return;

  paymentForm.addEventListener("submit", async function(e){
    e.preventDefault();
    
    const tontineId = document.getElementById("paymentTontine")?.value;
    const amountInput = this.querySelector('input[type="number"]');
    const amount = amountInput ? parseFloat(amountInput.value) : 0;
    
    if (!tontineId || !amount) {
      showNotification(" Veuillez sélectionner une tontine et entrer un montant", "error");
      return;
    }

    if (amount <= 0) {
      showNotification(" Le montant doit être positif", "error");
      return;
    }
    
    try{
      const button = this.querySelector('button[type="submit"]');
      const originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Paiement...';
      
      const res = await apiFetch('/payments/simulate', {
        method: "POST",
        body: JSON.stringify({ tontineId, amount })
      });
      
      showNotification("✅ " + (res.message || "Paiement simulé avec succès"), "success");
      this.reset();
      
      // Recharger les données
      await Promise.allSettled([
        loadPaymentHistory(),
        loadPaymentSummary(),
        loadFinancialOverview(),
        loadMyTontines(),
        loadTontinesSummary(),
        loadRecentTransactions()
      ]);
      
    }catch(err){
      showNotification("❌" + err.message, "error");
    }finally{
      const button = this.querySelector('button[type="submit"]');
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-check-lg"></i> Simuler le Paiement';
      }
    }
  });
}

// Mettre à jour le sélecteur de tontines pour les paiements
function updatePaymentTontineSelect(tontines) {
  const select = document.getElementById('paymentTontine');
  if (!select) return;
  
  select.innerHTML = '<option value="">Sélectionnez une tontine</option>';
  
  tontines.forEach(tontine => {
    if (tontine.payment_status !== 'completed') {
      const option = document.createElement('option');
      option.value = tontine.id;
      option.textContent = `${tontine.name} - ${formatCurrency(tontine.montant_par_participant || 0)}`;
      select.appendChild(option);
    }
  });

  if (select.options.length === 1) {
    select.innerHTML = '<option value="">Aucune tontine en attente de paiement</option>';
  }
}

// Affichage des tontines et corridors
async function loadAvailableTontines(){
  try{
    const res = await apiFetch('/participants/available');
    const tontines = res.data?.tontines || res.tontines || [];
    const corridors = res.data?.corridors || res.corridors || [];
    renderAvailable(tontines, corridors);
  }catch(err){
    handleError('loadAvailableTontines', err);
  }
}

function renderAvailable(tontines, corridors){
  const tEl = document.getElementById('availableTontines');
  const cEl = document.getElementById('availableCorridors');

  if(tEl){
    tEl.innerHTML = tontines.length ? tontines.map(t=>`
      <div class="item card p-3 mb-2">
        <h5>${escapeHtml(t.nom)}</h5>
        <div class="small text-muted">Organisateur: ${escapeHtml(t.organisateur_nom)} ${escapeHtml(t.organisateur_prenom)}</div>
        <div class="small text-muted">
          ${t.bareme ? `<i class="bi bi-currency-exchange"></i> ${formatCurrency(t.bareme)}` : ''}
          ${t.date ? ` • <i class="bi bi-calendar"></i> ${t.date.split("T")[0]}` : ''}
        </div>
        <div class="mt-2 d-flex gap-2">
          <button class="btn btn-info btn-sm" onclick="showDetails('tontine', ${JSON.stringify(t).replaceAll('"','&quot;')})">Voir détails</button>
          <button class="btn btn-primary btn-sm" onclick="requestJoinTontine(${t.id})">Demander à rejoindre</button>
        </div>
      </div>
    `).join('') : '<div class="text-muted">Aucune tontine disponible.</div>';
  }

  if(cEl){
    cEl.innerHTML = corridors.length ? corridors.map(c=>`
      <div class="item card p-3 mb-2">
        <h5>${escapeHtml(c.nom_corridor)}</h5>
        <div class="small text-muted">Organisateur: ${escapeHtml(c.organisateur_nom)} ${escapeHtml(c.organisateur_prenom)}</div>
        <div class="small text-muted">
          ${c.bareme ? `<i class="bi bi-currency-exchange"></i> ${formatCurrency(c.bareme)}` : ''}
        </div>
        <div class="mt-2 d-flex gap-2">
          <button class="btn btn-info btn-sm" onclick="showDetails('corridor', ${JSON.stringify(c).replaceAll('"','&quot;')})">Voir détails</button>
          <button class="btn btn-primary btn-sm" onclick="requestJoinCorridor(${c.id})">Demander à rejoindre</button>
        </div>
      </div>
    `).join('') : '<div class="text-muted">Aucun corridor disponible.</div>';
  }
}

// Rejoindre tontine / corridor
async function requestJoinTontine(tontineId){
  try{ 
    await apiFetch('/tontines/request-join', {
      method:'POST', 
      body: JSON.stringify({ tontineId })
    });
    showNotification(' Demande envoyée pour la tontine', 'success');
    loadNotifications();
  } catch(e){ 
    showNotification(e.message || 'Erreur lors de la demande', 'error');
  }
}

async function requestJoinCorridor(corridorId){
  try{ 
    await apiFetch('/participants/join/corridor', {
      method:'POST', 
      body: JSON.stringify({ corridorId })
    });
    showNotification(' Demande envoyée pour le corridor', 'success');
    loadNotifications();
  } catch(e){ 
    showNotification(e.message || 'Erreur lors de la demande', 'error');
  }
}

// Rejoindre via token
function joinByTokenPrompt(){
  const token = prompt('Entrez le token unique reçu:');
  if(!token) return;

  apiFetch('/tontines/join-by-token', {
    method:'POST',
    body: JSON.stringify({ token })
  })
  .then(()=> {
    showNotification(' Ajouté à la tontine via token', 'success');
    loadMyTontines();
    loadTontinesSummary();
    loadNotifications();
  })
  .catch(e=> showNotification(e.message || 'Erreur API', 'error'));
}

// Événement pour le formulaire de token
function initializeTokenForm() {
  const joinTokenForm = document.getElementById("joinTokenForm");
  if (!joinTokenForm) return;

  joinTokenForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tokenVal = e.target.token.value.trim();
    if (!tokenVal) {
      document.getElementById("joinTokenMsg").innerText = "Veuillez fournir un jeton.";
      return;
    }
    
    try {
      await apiFetch('/tontines/join-by-token', {
        method: "POST",
        body: JSON.stringify({ token: tokenVal })
      });
      
      document.getElementById("joinTokenMsg").innerHTML = '<span class="text-success">✅ Vous avez rejoint la tontine !</span>';
      e.target.reset();
      
      await Promise.allSettled([
        loadMyTontines(),
        loadTontinesSummary(),
        loadNotifications()
      ]);
      
      setTimeout(() => {
        const msgElement = document.getElementById("joinTokenMsg");
        if (msgElement) msgElement.innerText = "";
      }, 5000);
    } catch (err) {
      document.getElementById("joinTokenMsg").innerHTML = '<span class="text-danger">' + err.message + '</span>';
    }
  });
}

// Mes Tontines
async function loadMyTontines() {
  try {
    const res = await apiFetch("/participants/my-tontines");
    const myTontines = res.data || [];

    const container = document.getElementById("myTontinesList");
    if (!container) return;
    
    if (myTontines.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-piggy-bank fs-1"></i>
          <div class="mt-2">Vous n'êtes membre d'aucune tontine</div>
          <small>Rejoignez une tontine via l'onglet "Découvrir"</small>
        </div>
      `;
      return;
    }

    container.innerHTML = myTontines.map(tontine => `
      <div class="border rounded p-3 mb-3 ${tontine.payment_status === 'completed' ? 'payment-completed' : 'payment-pending'}">
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <strong>${escapeHtml(tontine.name)}</strong>
            <div class="small-muted">${escapeHtml(tontine.description || '')}</div>
            <div class="small text-muted">
              Organisateur: ${tontine.owner_prenom} ${tontine.owner_nom}
              • Rejoint le: ${new Date(tontine.joined_at).toLocaleDateString('fr-FR')}
            </div>
            <div class="mt-2">
              <span class="badge ${tontine.payment_status === 'completed' ? 'bg-success' : 'bg-warning'}">
                ${tontine.payment_status === 'completed' ? 'Paiement terminé' : 'Paiement en attente'}
              </span>
              ${tontine.funds_received ? '<span class="badge bg-info ms-1">Fonds reçus</span>' : ''}
            </div>
            ${tontine.payment_status === 'completed' && tontine.payment_date ? `
              <div class="small text-success mt-1">
                <i class="bi bi-cash-coin"></i> Payé le ${new Date(tontine.payment_date).toLocaleDateString('fr-FR')}
              </div>
            ` : ''}
            ${tontine.funds_received && tontine.fund_receipt_date ? `
              <div class="small text-info mt-1">
                <i class="bi bi-graph-up-arrow"></i> Fonds reçus le ${new Date(tontine.fund_receipt_date).toLocaleDateString('fr-FR')}
              </div>
            ` : ''}
          </div>
          <div class="d-flex gap-1">
            <button class="btn btn-outline-info btn-sm" onclick="viewTontineMembers(${tontine.id})">
              <i class="bi bi-people"></i> Membres
            </button>
            <button class="btn btn-outline-primary btn-sm" onclick="messageOrganizer(${tontine.owner_id}, ${tontine.id})">
              <i class="bi bi-envelope"></i> Contacter
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Mettre à jour les sélecteurs
    updateMessageSelectors(myTontines);
    updatePaymentTontineSelect(myTontines);

  } catch (err) {
    handleError('loadMyTontines', err);
  }
}

function updateMessageSelectors(tontines) {
  const tontineSelect = document.getElementById('messageToTontine');
  const organizerSelect = document.getElementById('messageToOrganizer');
  
  if (tontineSelect) {
    tontineSelect.innerHTML = '<option value="">Sélectionnez une tontine</option>' +
      tontines.map(t => `<option value="${t.id}" data-organizer="${t.owner_id}">${escapeHtml(t.name)}</option>`).join('');
  }

  if (organizerSelect) {
    organizerSelect.innerHTML = '<option value="">Sélectionnez un organisateur</option>' +
      tontines.map(t => `<option value="${t.owner_id}">${t.owner_prenom} ${t.owner_nom} - ${escapeHtml(t.name)}</option>`).join('');
  }

  // Mettre à jour l'organisateur quand la tontine change
  if (tontineSelect && organizerSelect) {
    tontineSelect.addEventListener('change', function() {
      const selectedOption = this.options[this.selectedIndex];
      const organizerId = selectedOption.getAttribute('data-organizer');
      if (organizerId) {
        organizerSelect.value = organizerId;
      }
    });
  }
}

// Modal details
let currentItem = null;
let currentType = null;

function showDetails(type, item){
  currentItem = item;
  currentType = type;
  const content = `
    <h5>${type==='tontine'?escapeHtml(item.nom):escapeHtml(item.nom_corridor)}</h5>
    <p><strong>Organisateur:</strong> ${escapeHtml(item.organisateur_nom||'—')} ${escapeHtml(item.organisateur_prenom||'')}</p>
    ${item.bareme?`<p><strong>Barème:</strong> ${formatCurrency(item.bareme)}</p>`:''}
    ${item.montant_par_participant?`<p><strong>Montant/participant:</strong> ${formatCurrency(item.montant_par_participant)}</p>`:''}
    ${item.duree_jours?`<p><strong>Durée:</strong> ${item.duree_jours} jours</p>`:''}
    <p><strong>Token unique:</strong> ${item.token_unique||'—'}</p>
  `;
  document.getElementById('modalContent').innerHTML = content;

  const joinBtn = document.getElementById('joinBtn');
  joinBtn.onclick = () => {
    if(type==='tontine') requestJoinTontine(item.id);
    else requestJoinCorridor(item.id);
    const modal = bootstrap.Modal.getInstance(document.getElementById('detailsModal'));
    if (modal) modal.hide();
  };

  const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
  modal.show();
}

// Gestion des Membres
async function viewTontineMembers(tontineId) {
  try {
    const res = await apiFetch(`/participants/tontines/${tontineId}/members`);
    const members = res.data || [];

    const membersHtml = members.map(member => `
      <div class="border rounded p-2 mb-2 ${member.payment_status === 'completed' ? 'payment-completed' : 'payment-pending'}">
        <strong>${member.prenom} ${member.nom}</strong>
        <div class="small text-muted">${member.email}</div>
        <div class="small">
          Statut: 
          <span class="badge ${member.payment_status === 'completed' ? 'bg-success' : 'bg-warning'}">
            ${member.payment_status === 'completed' ? 'Payé' : 'En attente'}
          </span>
          • Rejoint le: ${new Date(member.joined_at).toLocaleDateString('fr-FR')}
        </div>
      </div>
    `).join('');

    document.getElementById('paymentStatusSection').innerHTML = `
      <h6>Membres de la tontine</h6>
      ${membersHtml}
    `;

    // Basculer vers l'onglet messages
    showTab('tab-messages');
  } catch (err) {
    handleError('viewTontineMembers', err, 'Erreur lors du chargement des membres');
  }
}

function messageOrganizer(organizerId, tontineId) {
  document.getElementById('messageToOrganizer').value = organizerId;
  document.getElementById('messageToTontine').value = tontineId;
  
  showTab('tab-messages');
  const textarea = document.querySelector('#sendMessageForm textarea');
  if (textarea) textarea.focus();
}

// Messagerie
function initializeMessageForm() {
  const sendMessageForm = document.getElementById("sendMessageForm");
  if (!sendMessageForm) return;

  sendMessageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const organizerId = document.getElementById("messageToOrganizer")?.value;
    const tontineId = document.getElementById("messageToTontine")?.value;
    const messageContent = e.target.querySelector('textarea')?.value.trim();
    
    if (!organizerId) {
      showNotification("Veuillez sélectionner un organisateur", "error");
      return;
    }
    
    if (!messageContent) {
      showNotification("Veuillez écrire un message", "error");
      const textarea = e.target.querySelector('textarea');
      if (textarea) textarea.focus();
      return;
    }
    
    try {
      await apiFetch("/messages/send", {
        method: "POST",
        body: JSON.stringify({
          receiver_id: parseInt(organizerId),
          tontine_id: tontineId ? parseInt(tontineId) : null,
          message: messageContent
        })
      });
      
      showNotification(" Message envoyé avec succès", "success");
      e.target.querySelector('textarea').value = '';
      loadNotifications();
      
    } catch (err) {
      showNotification("❌ " + err.message, "error");
    }
  });
}

// Gestion des Notifications
async function loadNotifications() {
  try {
    const res = await apiFetch("/notifications");
    const notifications = res.data || [];
    
    updateNotificationCount(notifications.length);
    displayNotifications(notifications);
    
  } catch (err) {
    handleError('loadNotifications', err);
  }
}

function displayNotifications(notifications) {
  const notificationsEl = document.getElementById('notifications');
  if (!notificationsEl) return;
  
  if (notifications.length === 0) {
    notificationsEl.innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="bi bi-bell-slash fs-2"></i>
        <div class="mt-2">Aucune notification</div>
        <small class="text-muted">Vous serez alerté des nouvelles activités</small>
      </div>
    `;
    return;
  }
  
  notificationsEl.innerHTML = notifications.map(notification => `
    <div class="notification-item border-start border-3 border-primary ps-3 py-2 mb-2 bg-light rounded">
      <div class="d-flex justify-content-between align-items-start">
        <div class="flex-grow-1">
          <div class="small fw-bold text-dark mb-1">${escapeHtml(notification.title || 'Notification')}</div>
          <div class="small text-muted mb-1">${escapeHtml(notification.body || '')}</div>
          <div class="small text-muted">
            <i class="bi bi-clock"></i> 
            ${formatNotificationDate(notification.created_at)}
          </div>
        </div>
        <button class="btn btn-sm btn-outline-secondary ms-2" onclick="deleteSingleNotification(${notification.id})" title="Supprimer cette notification">
          <i class="bi bi-x"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function formatNotificationDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffTime / (1000 * 60));
  
  if (diffMinutes < 1) return 'À l\'instant';
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function updateNotificationCount(count) {
  const countEl = document.getElementById('notificationCount');
  if (countEl) {
    countEl.textContent = count;
    if (count === 0) {
      countEl.classList.remove('bg-primary');
      countEl.classList.add('bg-secondary');
      countEl.style.display = 'none';
    } else {
      countEl.classList.remove('bg-secondary');
      countEl.classList.add('bg-primary');
      countEl.style.display = 'flex';
    }
  }
}

function displayNotificationError(errorMessage) {
  const notificationsEl = document.getElementById('notifications');
  if (!notificationsEl) return;
  
  notificationsEl.innerHTML = `
    <div class="text-center text-danger py-3">
      <i class="bi bi-exclamation-triangle fs-2"></i>
      <div class="mt-2">Erreur de chargement</div>
      <small class="text-muted">${errorMessage}</small>
      <div class="mt-2">
        <button class="btn btn-sm btn-outline-primary" onclick="loadNotifications()">
          <i class="bi bi-arrow-clockwise"></i> Réessayer
        </button>
      </div>
    </div>
  `;
}

// Initialisation des événements pour les notifications
function initNotificationEvents() {
  const btnClear = document.getElementById('btnClearNotifications');
  const btnRefresh = document.getElementById('btnRefreshNotifications');
  
  if (btnClear) {
    btnClear.addEventListener('click', clearAllNotifications);
  }
  
  if (btnRefresh) {
    btnRefresh.addEventListener('click', refreshNotifications);
  }
}

async function clearAllNotifications() {
  if (!confirm("Êtes-vous sûr de vouloir supprimer toutes vos notifications ?\n\nCette action est irréversible.")) {
    return;
  }

  try {
    await apiFetch("/notifications/clear-all", {method:'DELETE'});
    await loadNotifications();
    showNotification(" Toutes les notifications ont été supprimées", "success");
  } catch (err) {
    showNotification(`❌ ${err.message}`, "error");
  }
}

async function deleteSingleNotification(notificationId) {
  if (!confirm("Supprimer cette notification ?")) {
    return;
  }

  try {
    await apiFetch(`/notifications/${notificationId}`, {method:'DELETE'});
    await loadNotifications();
    showNotification(" Notification supprimée", "success");
  } catch (err) {
    showNotification(`❌ ${err.message}`, "error");
  }
}

async function refreshNotifications() {
  const btnRefresh = document.getElementById('btnRefreshNotifications');
  if (!btnRefresh) return;

  const originalContent = btnRefresh.innerHTML;
  btnRefresh.innerHTML = '<i class="bi bi-arrow-clockwise spinner-border spinner-border-sm"></i>';
  await loadNotifications();
  btnRefresh.innerHTML = originalContent;
}

// Messages Reçus
async function loadReceivedMessages() {
  try {
    const res = await apiFetch("/messages/conversations");
    const conversations = res.data || [];

    const container = document.getElementById("receivedMessages");
    if (!container) return;
    
    if (conversations.length === 0) {
      container.innerHTML = "<div class='text-center text-muted'>Aucun message</div>";
      return;
    }

    container.innerHTML = conversations.map(conv => `
      <div class="border rounded p-3 mb-2">
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <strong>${conv.prenom} ${conv.nom}</strong>
            ${conv.unread_count > 0 ? `<span class="badge bg-danger ms-2">${conv.unread_count}</span>` : ''}
            <div class="small text-muted">${escapeHtml(conv.last_message)}</div>
            <div class="small text-muted">
              ${conv.tontine_name ? `Tontine: ${conv.tontine_name}` : ''}
              ${conv.corridor_name ? `Corridor: ${conv.corridor_name}` : ''}
            </div>
          </div>
          <div class="small text-muted text-end">
            ${new Date(conv.last_message_date).toLocaleDateString('fr-FR')}
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    handleError('loadReceivedMessages', err);
  }
}

// Gestion de la Déconnexion
function initializeLogout() {
  const btnLogout = document.getElementById("btnLogout");
  const btnProfile = document.getElementById("btnProfile");

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem("mec_token");
      localStorage.removeItem("mec_role");
      window.location.href = "login.html";
    });
  }

  if (btnProfile) {
    btnProfile.addEventListener("click", () => {
      window.location.href = "profile.html";
    });
  }
}

// INITIALISATION

// Démarrer l'application
document.addEventListener('DOMContentLoaded', function() {
  // Vérifier l'authentification
  const token = localStorage.getItem("mec_token");
  const role = localStorage.getItem("mec_role");
  
  if (!token || role !== "participant") {
    window.location.href = "login.html";
    return;
  }

  // Initialiser tous les événements
  initializePaymentForm();
  initializeTokenForm();
  initializeMessageForm();
  initializeLogout();
  initNotificationEvents();
  
  // Charger le dashboard
  loadParticipantDashboard();

  // Actualisation périodique avec gestion d'erreur
  setInterval(() => {
    Promise.allSettled([
      loadNotifications(),
      loadFinancialOverview(),
      loadRecentTransactions()
    ]).catch(err => {
      console.error('Erreur lors de l\'actualisation périodique:', err);
    });
  }, 10000); // Toutes les 10 secondes
});