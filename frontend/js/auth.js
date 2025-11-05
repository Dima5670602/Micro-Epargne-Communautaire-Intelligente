// Gestion de l'authentification
const API_URL = 'http://localhost:3000/api';

// Stocker le token dans le localStorage
function saveToken(token) {
    localStorage.setItem('TOKEN', token);
}

// Récupérer le token du localStorage
function getToken() {
    return localStorage.getItem('TOKEN');
}

// Supprimer le token (déconnexion)
function removeToken() {
    localStorage.removeItem('TOKEN');
    localStorage.removeItem('currentUser');
}

// Vérifier si l'utilisateur est connecté
function isLoggedIn() {
    return !!getToken();
}

// Rediriger vers la page de connexion si non authentifié
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Fonction d'inscription
async function registerUser(formData) {
    try {
        console.log('Inscription en cours...');
        
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors de l\'inscription');
        }

        // Sauvegarder le token et rediriger
        saveToken(data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        console.log('Inscription réussie');
        return data;

    } catch (error) {
        console.error('Erreur inscription:', error);
        throw error;
    }
}

// Fonction de connexion
async function loginUser(email, password) {
    try {
        console.log('📤 Connexion en cours...');
        
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors de la connexion');
        }

        // Sauvegarder le token et rediriger
        saveToken(data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        console.log('Connexion réussie');
        return data;

    } catch (error) {
        console.error('Erreur connexion:', error);
        throw error;
    }
}

// Fonction de déconnexion
function logout() {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
        removeToken();
        window.location.href = '/login.html';
    }
}

// Vérifier le token et rediriger vers le bon dashboard
async function checkAuthAndRedirect() {
    if (!isLoggedIn()) {
        return false;
    }

    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        const data = await response.json();

        if (data.valid) {
            // Rediriger vers le dashboard approprié
            localStorage.setItem('mec_role', data.user.role);
            const currentPath = window.location.pathname;
            
            // Si on est sur login/register, rediriger vers le dashboard
            if (currentPath.includes('login.html') || currentPath.includes('register.html') || currentPath === '/') {
                const dashboard = data.user.role === 'organisateur' 
                    ? 'dashboard_organizer.html' 
                    : 'dashboard_participant.html';
                window.location.href = `/${dashboard}`;
                return data.user;
            }
            
            return data.user;
        } else {
            removeToken();
            if (!window.location.pathname.includes('login.html') && 
                !window.location.pathname.includes('register.html') &&
                !window.location.pathname.includes('index.html')) {
                window.location.href = '/login.html';
            }
            return null;
        }
    } catch (error) {
        console.error('Erreur vérification auth:', error);
        removeToken();
        if (!window.location.pathname.includes('login.html') && 
            !window.location.pathname.includes('register.html') &&
            !window.location.pathname.includes('index.html')) {
            window.location.href = '/login.html';
        }
        return null;
    }
}

// Récupérer l'utilisateur courant
function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}

// Afficher les informations utilisateur dans la navbar
function displayUserInfo() {
    const user = getCurrentUser();
    if (user) {
        const userElements = document.querySelectorAll('.user-name, .user-info');
        userElements.forEach(element => {
            element.textContent = `${user.prenom} ${user.nom}`;
        });
    }
}

// Initialiser l'authentification au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initialisation authentification...');
    
    // Liste des pages protégées
    const protectedPages = [
        'dashboard_organizer.html',
        'dashboard_participant.html',
        'profile.html',
        'create_tontine.html',
        'create_corridor.html'
    ];
    
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage)) {
        // vérifier l'authentification
        checkAuthAndRedirect().then(user => {
            if (user) {
                displayUserInfo();
            }
        });
    } else if (currentPage === 'login.html' || currentPage === 'register.html') {
        // Page de connexion/inscription et rediriger si déjà connecté
        checkAuthAndRedirect();
    }

    // Gérer le bouton de déconnexion
    const logoutButtons = document.querySelectorAll('.btn-logout, [onclick="logout()"]');
    logoutButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    });
});

// Fonction utilitaire pour valider les emails
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Fonction utilitaire pour valider les mots de passe
function isValidPassword(password) {
    return password && password.length >= 6;
}

// Exporter les fonctions pour une utilisation globale
window.auth = {
    registerUser,
    loginUser,
    logout,
    isLoggedIn,
    getToken,
    getCurrentUser,
    checkAuthAndRedirect,
    isValidEmail,
    isValidPassword,
    requireAuth
};