-- SCHÉMA COMPLET - BASE DE DONNÉES

-- Suppression des tables existantes (pour réinitialisation)
DROP TABLE IF EXISTS corridor_participants CASCADE;
DROP TABLE IF EXISTS tontine_participants CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS user_activity CASCADE;
DROP TABLE IF EXISTS corridors CASCADE;
DROP TABLE IF EXISTS tontines CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- TABLE USERS

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  telephone VARCHAR(20),
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('organisateur', 'participant')),
  is_premium BOOLEAN DEFAULT FALSE,
  date_naissance DATE,
  pays VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);


-- TABLE TONTINES

CREATE TABLE tontines (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  date DATE,
  bareme VARCHAR(100),
  commission DECIMAL(10,2) DEFAULT 0,
  phone VARCHAR(20),
  token VARCHAR(255) UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performance
CREATE INDEX idx_tontines_owner ON tontines(owner_id);
CREATE INDEX idx_tontines_token ON tontines(token);
CREATE INDEX idx_tontines_active ON tontines(active);

-- TABLE CORRIDORS

CREATE TABLE corridors (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  bareme DECIMAL(10,2),
  commission DECIMAL(10,2) DEFAULT 0,
  phone VARCHAR(20),
  token_unique VARCHAR(255) UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performance
CREATE INDEX idx_corridors_owner ON corridors(owner_id);
CREATE INDEX idx_corridors_token ON corridors(token_unique);
CREATE INDEX idx_corridors_active ON corridors(active);


-- TABLE TONTINE_PARTICIPANTS

CREATE TABLE tontine_participants (
  id SERIAL PRIMARY KEY,
  tontine_id INTEGER REFERENCES tontines(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'inactive')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tontine_id, user_id)
);

-- Index pour performance
CREATE INDEX idx_tontine_participants_user ON tontine_participants(user_id);
CREATE INDEX idx_tontine_participants_tontine ON tontine_participants(tontine_id);
CREATE INDEX idx_tontine_participants_status ON tontine_participants(status);


-- TABLE CORRIDOR_PARTICIPANTS

CREATE TABLE corridor_participants (
  id SERIAL PRIMARY KEY,
  corridor_id INTEGER REFERENCES corridors(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(corridor_id, user_id)
);

-- Index pour performance
CREATE INDEX idx_corridor_participants_user ON corridor_participants(user_id);
CREATE INDEX idx_corridor_participants_corridor ON corridor_participants(corridor_id);
CREATE INDEX idx_corridor_participants_status ON corridor_participants(status);


-- TABLE NOTIFICATIONS

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  body TEXT,
  meta JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performance
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- TABLE PAYMENTS

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performance
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at);


-- TABLE USER_ACTIVITY (pour analytics)

CREATE TABLE user_activity (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100),
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performance
CREATE INDEX idx_user_activity_user ON user_activity(user_id);
CREATE INDEX idx_user_activity_created ON user_activity(created_at);

-- TRIGGERS POUR updated_at

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tontines_updated_at BEFORE UPDATE ON tontines
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_corridors_updated_at BEFORE UPDATE ON corridors
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- DONNÉES DE TEST (optionnel)
-- ========================================
-- Vous pouvez décommenter pour avoir des données de test

/*
-- Créer un organisateur de test (mot de passe: test123)
INSERT INTO users (nom, prenom, email, password, role, is_premium)
VALUES ('Test', 'Organisateur', 'org@test.com', '$2b$10$xyz...', 'organisateur', false);

-- Créer un participant de test (mot de passe: test123)
INSERT INTO users (nom, prenom, email, password, role)
VALUES ('Test', 'Participant', 'part@test.com', '$2b$10$xyz...', 'participant');
*/

-- ========================================
-- FIN DU SCHÉMA
-- ========================================