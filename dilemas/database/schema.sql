-- Esquema de base de datos para Dilemas ESAN

-- Tabla principal de casos pedagógicos.
create table if not exists dilemas_casos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  brief text,
  introduction text,
  dilemma text,
  image_url text,
  animation_url text,
  decisions jsonb,
  reflection text,
  bibliography text,
  created_at timestamp with time zone default now()
);

-- Tabla de sesiones activas / históricas.
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  room_id text unique not null,
  case_id uuid references dilemas_casos(id) on delete set null,
  teacher_name text,
  state text,
  current_step text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Tabla de participantes por sala.
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references sessions(room_id) on delete cascade,
  name text not null,
  student_code text,
  connected boolean default true,
  joined_at timestamp with time zone default now()
);

-- Tabla de votos registrados en cada sala.
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references sessions(room_id) on delete cascade,
  participant_id uuid references participants(id) on delete set null,
  option_key text,
  created_at timestamp with time zone default now()
);

-- Ejemplo de caso inicial.
insert into dilemas_casos (title, category, brief, introduction, dilemma, decisions, reflection, bibliography)
values (
  '¿Quién es el experto? ¿El consultor o la IA?',
  'Ética y tecnología',
  'Un caso sobre el uso de IA en reuniones con clientes y las implicaciones de transparencia.',
  'Vikasa es una consultora digital que evalúa cómo incorporar IA en procesos de atención al cliente.',
  '¿Debe Vikasa permitir el uso de IA indetectable en reuniones con clientes?',
  '[
    {"key": "A", "label": "Permitir IA indetectable", "outcome": "Aumento de productividad seguido de pérdida de confianza."},
    {"key": "B", "label": "Permitir IA transparente", "outcome": "Balance entre ética e innovación."},
    {"key": "C", "label": "Prohibir completamente la IA", "outcome": "Menor innovación, mayor control."}
  ]',
  'Reflexiona sobre cómo la transparencia influye en reputación, adopción y liderazgo ético en la empresa.',
  'https://ejemplo.com/articulo-ia-etica'
);
