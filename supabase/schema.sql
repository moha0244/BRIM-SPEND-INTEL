-- ============================================================
-- BRIM SPEND INTELLIGENCE — Schema complet
-- Version : dynamique — aucune donnée statique hardcodée
-- Les labels MCC viennent de la table mcc_labels (seed depuis fichier)
-- La vue v_transactions_enriched fait un JOIN dynamique
-- ============================================================

-- ─── Tables de base ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cards (
  code      INTEGER PRIMARY KEY,
  label     TEXT    NOT NULL,
  card_type TEXT    NOT NULL DEFAULT 'corporate'
);

CREATE TABLE IF NOT EXISTS mcc_labels (
  mcc      INTEGER PRIMARY KEY,
  label_fr TEXT    NOT NULL,
  category TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id                     BIGSERIAL PRIMARY KEY,
  transaction_code       INTEGER       NOT NULL REFERENCES cards(code),
  transaction_description TEXT         NOT NULL,
  transaction_category   INTEGER,
  posting_date           DATE          NOT NULL,
  transaction_date       DATE          NOT NULL,
  merchant_name          TEXT          NOT NULL,
  amount                 NUMERIC(12,2) NOT NULL,
  debit_or_credit        TEXT          NOT NULL CHECK (debit_or_credit IN ('Debit', 'Credit')),
  merchant_category_code INTEGER,
  merchant_city          TEXT,
  merchant_country       TEXT,
  merchant_postal_code   TEXT,
  merchant_state_province TEXT,
  conversion_rate        NUMERIC(12,10) DEFAULT 0,

  currency TEXT GENERATED ALWAYS AS (
    CASE WHEN conversion_rate = 0 THEN 'CAD' ELSE 'USD' END
  ) STORED,

  amount_cad NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE
      WHEN conversion_rate = 0 THEN amount
      ELSE ROUND(amount / conversion_rate, 2)
    END
  ) STORED,

  compliance_status  TEXT DEFAULT 'pending'
    CHECK (compliance_status IN ('pending','ok','flagged','violation')),
  approval_status    TEXT DEFAULT 'auto_approved'
    CHECK (approval_status IN ('auto_approved','pending_approval','approved','rejected')),
  compliance_checked_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_documents (
  id         BIGSERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  raw_text   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_rules (
  id                  BIGSERIAL PRIMARY KEY,
  policy_document_id  BIGINT REFERENCES policy_documents(id),
  rule_code           TEXT UNIQUE NOT NULL,
  category            TEXT NOT NULL,
  description_fr      TEXT NOT NULL,
  rule_type           TEXT NOT NULL,
  condition_json      JSONB NOT NULL,
  threshold_amount    NUMERIC(10,2),
  action              TEXT NOT NULL,
  severity            TEXT NOT NULL,
  evidence_text       TEXT NOT NULL,
  is_active           BOOLEAN DEFAULT TRUE,
  detection_sql       TEXT,       -- Requête SQL générée par Mistral pour détecter les violations
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_violations (
  id             BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id),
  rule_id        BIGINT NOT NULL REFERENCES policy_rules(id),
  severity       TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  ai_explanation TEXT,
  status         TEXT DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  detected_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id               BIGSERIAL PRIMARY KEY,
  transaction_id   BIGINT NOT NULL REFERENCES transactions(id),
  triggered_by_rule BIGINT REFERENCES policy_rules(id),
  ai_recommendation TEXT NOT NULL,  -- Valeurs françaises : 'Approuver', 'Refuser', 'Prudence'
  ai_reasoning     TEXT,
  decision         TEXT,            -- NULL = en attente, 'approved', 'rejected'
  decision_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_reports (
  id               BIGSERIAL PRIMARY KEY,
  report_name      TEXT NOT NULL,
  transaction_code INTEGER NOT NULL REFERENCES cards(code),
  date_start       DATE NOT NULL,
  date_end         DATE NOT NULL,
  total_amount_cad NUMERIC(12,2),
  transaction_count INTEGER,
  ai_summary       TEXT,
  compliance_summary TEXT,
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending_cfo','approved','rejected')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_report_items (
  report_id      BIGINT NOT NULL REFERENCES expense_reports(id),
  transaction_id BIGINT NOT NULL REFERENCES transactions(id),
  PRIMARY KEY (report_id, transaction_id)
);

-- ─── Vue enrichie (JOIN dynamique sur mcc_labels) ────────────

CREATE OR REPLACE VIEW v_transactions_enriched AS
SELECT
  t.id,
  t.transaction_code,
  c.label                                                    AS card_label,
  t.transaction_date,
  t.posting_date,
  t.merchant_name,
  t.transaction_description,
  t.amount,
  t.currency,
  t.amount_cad,
  t.debit_or_credit,
  t.merchant_category_code                                   AS mcc,
  COALESCE(m.label_fr, 'Autre (' || t.merchant_category_code::TEXT || ')') AS mcc_label,
  COALESCE(m.category, 'Divers')                             AS mcc_category,
  t.merchant_city,
  t.merchant_country,
  t.merchant_state_province,
  t.compliance_status,
  t.approval_status,
  t.created_at
FROM transactions t
LEFT JOIN cards c ON c.code = t.transaction_code
LEFT JOIN mcc_labels m ON m.mcc = t.merchant_category_code;

-- ─── Index ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_transactions_code       ON transactions(transaction_code);
CREATE INDEX IF NOT EXISTS idx_transactions_date       ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_mcc        ON transactions(merchant_category_code);
CREATE INDEX IF NOT EXISTS idx_transactions_compliance ON transactions(compliance_status);
CREATE INDEX IF NOT EXISTS idx_violations_transaction  ON compliance_violations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_approvals_transaction   ON approval_requests(transaction_id);


-- ─── Données de référence MCC (standard ISO 18245 — fixe) ───
-- Ces codes sont un standard mondial, ils n'évoluent pas avec les transactions
-- Si un nouveau MCC apparaît, la vue affiche "Autre (XXXX)" — ajouter ici si besoin

INSERT INTO mcc_labels (mcc, label_fr, category) VALUES
  (742,  'Vétérinaire', 'Services'),
  (763,  'Fournitures agricoles', 'Divers'),
  (780,  'Services jardinage', 'Services'),
  (1520, 'Construction générale', 'Services'),
  (1711, 'Plomberie / Chauffage', 'Services'),
  (1799, 'Travaux spéciaux', 'Services'),
  (2842, 'Produits nettoyage', 'Services'),
  (3009, 'Transport aérien', 'Transport'),
  (3366, 'Location Hertz', 'Location véhicule'),
  (3405, 'Hôtel divers', 'Hébergement'),
  (3501, 'Hôtel Holiday Inn Express', 'Hébergement'),
  (3502, 'Hôtel Holiday Inn', 'Hébergement'),
  (3508, 'Hôtel Crowne Plaza', 'Hébergement'),
  (3510, 'Hôtel Hilton', 'Hébergement'),
  (3516, 'Hertz Location', 'Location véhicule'),
  (3528, 'Hôtel Marriott', 'Hébergement'),
  (3613, 'Hôtel divers', 'Hébergement'),
  (3615, 'Hôtel Radisson', 'Hébergement'),
  (3631, 'Hôtel divers', 'Hébergement'),
  (3637, 'Hôtel Marriott', 'Hébergement'),
  (3665, 'Thrifty Location', 'Location véhicule'),
  (3700, 'Hôtel Wyndham', 'Hébergement'),
  (3709, 'Location auto divers', 'Location véhicule'),
  (3722, 'Hôtel divers', 'Hébergement'),
  (4121, 'Taxi / Transport', 'Transport'),
  (4214, 'Camionnage / Transport marchandises', 'Transport'),
  (4215, 'Livraison / Courrier express', 'Livraison'),
  (4511, 'Billet d''avion', 'Transport'),
  (4722, 'Agence de voyage', 'Transport'),
  (4784, 'Péages / Frais routiers', 'Transport'),
  (4789, 'Services transport divers', 'Transport'),
  (4812, 'Télécommunications', 'Télécommunications'),
  (4816, 'Services en ligne / Amazon', 'Achats en ligne'),
  (4899, 'Câble / Services comm.', 'Télécommunications'),
  (4900, 'Services publics / Énergie', 'Services'),
  (5013, 'Pièces auto / Accessoires', 'Véhicule'),
  (5039, 'Matériaux construction divers', 'Pièces & Équipement'),
  (5045, 'Ordinateurs / Périphériques', 'Technologie'),
  (5046, 'Pièces et équipements commerciaux', 'Pièces & Équipement'),
  (5047, 'Fournitures médicales / Industrielles', 'Pièces & Équipement'),
  (5085, 'Fournitures industrielles', 'Pièces & Équipement'),
  (5099, 'Biens durables divers', 'Divers'),
  (5199, 'Produits divers non durables', 'Divers'),
  (5200, 'Rénovation / Home Depot', 'Pièces & Équipement'),
  (5211, 'Matériaux de construction', 'Pièces & Équipement'),
  (5231, 'Vitrerie / Peinture', 'Services'),
  (5251, 'Quincaillerie', 'Pièces & Équipement'),
  (5300, 'Commerce de gros / Costco', 'Achats en ligne'),
  (5310, 'Magasin grande surface', 'Achats en ligne'),
  (5311, 'Grand magasin', 'Divers'),
  (5331, 'Magasin tout à 1$', 'Divers'),
  (5399, 'Marchandises générales', 'Divers'),
  (5411, 'Épicerie / Supermarché', 'Alimentation'),
  (5462, 'Boulangerie', 'Alimentation'),
  (5499, 'Alimentation spécialisée', 'Alimentation'),
  (5511, 'Concessionnaire auto', 'Véhicule'),
  (5532, 'Magasin de pneus', 'Véhicule'),
  (5533, 'Magasin pièces auto', 'Véhicule'),
  (5541, 'Station-service / Carburant', 'Carburant'),
  (5542, 'Distributeur carburant automatique', 'Carburant'),
  (5561, 'Concessionnaire remorques', 'Véhicule'),
  (5599, 'Pièces auto divers', 'Véhicule'),
  (5661, 'Magasin de chaussures', 'Divers'),
  (5732, 'Électronique', 'Technologie'),
  (5734, 'Informatique / Logiciels', 'Technologie'),
  (5812, 'Restaurant', 'Repas & Divertissement'),
  (5814, 'Restaurant', 'Repas & Divertissement'),
  (5817, 'Application numérique', 'Technologie'),
  (5818, 'Jeux / Applications numériques', 'Technologie'),
  (5912, 'Pharmacie', 'Santé'),
  (5931, 'Magasin occasion', 'Divers'),
  (5942, 'Librairie', 'Bureau'),
  (5943, 'Papeterie / Fournitures bureau', 'Bureau'),
  (5947, 'Cadeaux / Cartes-cadeaux', 'Divers'),
  (5968, 'Abonnement / Services récurrents', 'Services'),
  (5992, 'Fleuriste', 'Divers'),
  (5999, 'Commerces divers', 'Divers'),
  (6011, 'Retrait ATM / Banque', 'Banque'),
  (6300, 'Assurance', 'Services'),
  (7011, 'Hôtel / Hébergement', 'Hébergement'),
  (7299, 'Services personnels', 'Services'),
  (7311, 'Publicité', 'Services'),
  (7342, 'Nettoyage / Entretien', 'Services'),
  (7372, 'Logiciels / SaaS', 'Technologie'),
  (7375, 'Traitement de données', 'Technologie'),
  (7392, 'Consultation / Services professionnels', 'Services'),
  (7393, 'Services de sécurité', 'Services'),
  (7399, 'Services aux entreprises divers', 'Services'),
  (7523, 'Stationnement', 'Transport'),
  (7531, 'Carrosserie auto', 'Véhicule'),
  (7534, 'Réparation pneus', 'Véhicule'),
  (7538, 'Réparation auto / Pneus', 'Véhicule'),
  (7542, 'Lave-auto', 'Véhicule'),
  (7549, 'Service de remorquage', 'Véhicule'),
  (7699, 'Réparation divers', 'Services'),
  (8099, 'Services de santé', 'Santé'),
  (8220, 'Services transport spécialisés', 'Transport'),
  (8299, 'Formation / École', 'Formation'),
  (8398, 'Organisme de bienfaisance', 'Divers'),
  (8675, 'Association automobile', 'Services'),
  (8699, 'Organisation membre divers', 'Services'),
  (8999, 'Services divers', 'Services'),
  (9211, 'Amende / Cour', 'Permis & Gouvernement'),
  (9311, 'Impôts / Gouvernement', 'Permis & Gouvernement'),
  (9399, 'Services gouvernementaux / Permis', 'Permis & Gouvernement')
ON CONFLICT (mcc) DO UPDATE SET
  label_fr = EXCLUDED.label_fr,
  category = EXCLUDED.category;


-- ─── Index supplémentaires ───────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_violations_status    ON compliance_violations(status);
CREATE INDEX IF NOT EXISTS idx_violations_severity  ON compliance_violations(severity);
CREATE INDEX IF NOT EXISTS idx_approvals_decision   ON approval_requests(decision);
CREATE INDEX IF NOT EXISTS idx_policy_rules_active  ON policy_rules(is_active);

-- ─── Fonction RPC pour le chat IA ────────────────────────────

CREATE OR REPLACE FUNCTION execute_sql(query TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  query_upper TEXT;
BEGIN
  query_upper := UPPER(TRIM(query));
  IF query_upper NOT LIKE 'SELECT%' AND query_upper NOT LIKE 'WITH%' THEN
    RAISE EXCEPTION 'Seules les requêtes SELECT sont autorisées.';
  END IF;
  IF query_upper ~ '(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)' THEN
    RAISE EXCEPTION 'Requête non autorisée.';
  END IF;
  EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
  RETURN COALESCE(result, '[]'::JSON);
END;
$$;

GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO service_role;

-- ─── Fonction RPC pour la détection de conformité ────────────
-- Utilisée par l'API /api/compliance pour exécuter les detection_sql

CREATE OR REPLACE FUNCTION run_sql_query(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION run_sql_query(TEXT) TO service_role;

-- Contrainte unique sur compliance_violations pour éviter les doublons
ALTER TABLE compliance_violations
  DROP CONSTRAINT IF EXISTS compliance_violations_transaction_rule_unique;
ALTER TABLE compliance_violations
  ADD CONSTRAINT compliance_violations_transaction_rule_unique
  UNIQUE (transaction_id, rule_id);

-- ─── Permissions — service role ──────────────────────────────────────────────

-- Désactiver RLS (le backend utilise le service role, pas les utilisateurs finaux)
ALTER TABLE cards                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions          DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcc_labels            DISABLE ROW LEVEL SECURITY;
ALTER TABLE policy_rules          DISABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_violations DISABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests     DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_reports       DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_report_items  DISABLE ROW LEVEL SECURITY;

-- Droits complets sur toutes les tables et séquences
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
