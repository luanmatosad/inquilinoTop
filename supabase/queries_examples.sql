-- EXEMPLOS DE QUERIES (Supabase SQL Editor ou via Client)

-- 1. Listar properties do owner (usuário logado)
-- A policy 'Users can view own properties' garante que apenas os imóveis do usuário autenticado retornem.
select * from properties;

-- 2. Listar units por property_id (respeitando RLS)
-- A policy 'Users can view units of own properties' garante que o usuário só veja unidades de seus próprios imóveis.
select * from units
where property_id = 'UUID_DA_PROPRIEDADE';

-- 3. Inserir uma nova propriedade
insert into properties (owner_id, type, name, address_line, city, state)
values (auth.uid(), 'RESIDENTIAL', 'Edifício Solar', 'Rua das Flores, 123', 'São Paulo', 'SP');

-- 4. Inserir uma unidade para a propriedade acima (assumindo que você tem o ID da propriedade)
insert into units (property_id, label, floor, notes)
values ('UUID_DA_PROPRIEDADE_CRIADA', 'Apt 101', '1', 'Reformado recentemente');

-- 5. Teste de segurança (tente acessar dados de outro usuário)
-- Se você tentar selecionar dados de outro usuário, a query retornará vazio devido ao RLS.
select * from properties where owner_id = 'UUID_DE_OUTRO_USUARIO';
-- Resultado esperado: 0 linhas (se o RLS estiver funcionando corretamente).
