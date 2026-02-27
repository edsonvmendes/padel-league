-- ============================================
-- SEED DATA - Dados de Teste
-- ============================================

-- 1. CRIAR VENUE
INSERT INTO venues (id, name, address) VALUES 
('00000000-0000-0000-0000-000000000001', 'Clube Padel Central', 'Av. Principal, 1000 - Centro');

-- 2. CRIAR QUADRAS FÍSICAS
INSERT INTO physical_courts (venue_id, court_number, name) VALUES 
('00000000-0000-0000-0000-000000000001', 1, 'Quadra Central'),
('00000000-0000-0000-0000-000000000001', 2, 'Quadra 2'),
('00000000-0000-0000-0000-000000000001', 3, 'Quadra 3'),
('00000000-0000-0000-0000-000000000001', 4, 'Quadra Coberta 1'),
('00000000-0000-0000-0000-000000000001', 5, 'Quadra Coberta 2'),
('00000000-0000-0000-0000-000000000001', 6, 'Quadra 6');

-- 3. CRIAR JOGADORAS (20 jogadoras de exemplo)
INSERT INTO players (name, email) VALUES 
('Ana Silva', 'ana.silva@email.com'),
('Beatriz Costa', 'bia.costa@email.com'),
('Carolina Souza', 'carol.souza@email.com'),
('Daniela Lima', 'dani.lima@email.com'),
('Eduarda Santos', 'duda.santos@email.com'),
('Fernanda Oliveira', 'fe.oliveira@email.com'),
('Gabriela Alves', 'gabi.alves@email.com'),
('Helena Rocha', 'helena.rocha@email.com'),
('Isabela Martins', 'isa.martins@email.com'),
('Juliana Ferreira', 'ju.ferreira@email.com'),
('Karla Dias', 'karla.dias@email.com'),
('Larissa Gomes', 'lari.gomes@email.com'),
('Mariana Ribeiro', 'mari.ribeiro@email.com'),
('Natália Cardoso', 'nat.cardoso@email.com'),
('Olivia Teixeira', 'oli.teixeira@email.com'),
('Patrícia Moura', 'patri.moura@email.com'),
('Queila Barbosa', 'queila.barbosa@email.com'),
('Rafaela Pinto', 'rafa.pinto@email.com'),
('Sofia Freitas', 'sofia.freitas@email.com'),
('Tatiana Nunes', 'tati.nunes@email.com');

-- 4. CRIAR LIGA DE EXEMPLO
INSERT INTO leagues (id, venue_id, name, start_date, end_date, status) VALUES 
('00000000-0000-0000-0000-000000000002', 
 '00000000-0000-0000-0000-000000000001', 
 'Liga Verão 2026',
 '2026-02-15',
 '2026-04-15',
 'active');

-- 5. CRIAR PRIMEIRA JORNADA
INSERT INTO rounds (id, league_id, round_number, round_date, status) VALUES 
('00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000002',
 1,
 '2026-02-15',
 'pending');

-- ============================================
-- NOTA IMPORTANTE:
-- Para criar um usuário ADMIN, você precisa:
-- 1. Criar uma conta via Supabase Auth (email/senha)
-- 2. Pegar o UUID do usuário criado
-- 3. Rodar: INSERT INTO user_roles (user_id, role) VALUES ('seu-uuid-aqui', 'admin');
-- ============================================
