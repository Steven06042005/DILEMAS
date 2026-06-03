// Servicio de integración con Supabase.
// Reemplaza estas constantes con tus credenciales seguras de Supabase.
const SUPABASE_URL = "https://vuaibxbcftgzamagactn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1YWlieGJjZnRnemFtYWdhY3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzE2ODIsImV4cCI6MjA5NTkwNzY4Mn0.yNtBWd_owKGwfrSsQcHv8tXsM8sBwOVKkoEzHqIzHQI";

// Inicializa el cliente de Supabase.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("Supabase inicializado:", { SUPABASE_URL, clientExists: !!supabaseClient });

// Funciones de administración de casos.
async function fetchCases() {
  const { data, error } = await supabaseClient
    .from("dilemas_casos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Supabase fetchCases error:", error);
    return [];
  }
  return data.map(normalizeCaseRecord);
}

async function upsertCase(caso) {
  const record = {
    id: caso.id || undefined,
    title: caso.title,
    category: caso.category,
    brief: caso.brief,
    introduction: caso.introduction,
    dilemma: caso.dilemma,
    image_url: caso.imageUrl || null,
    animation_url: caso.animationUrl || null,
    decisions: caso.decisions,
    reflection: caso.reflection,
    bibliography: caso.bibliography || null,
  };

  const { data, error } = await supabaseClient
    .from("dilemas_casos")
    .upsert(record, { onConflict: "id" })
    .select();

  if (error) {
    console.error("Supabase upsertCase error:", error);
    throw error;
  }
  return normalizeCaseRecord(data[0]);
}

async function removeCase(caseId) {
  const { error } = await supabaseClient.from("dilemas_casos").delete().eq("id", caseId);
  if (error) {
    console.error("Supabase removeCase error:", error);
    throw error;
  }
}

async function createSession(roomId, caseId, teacher) {
  const { data, error } = await supabaseClient
    .from("sessions")
    .insert([{ room_id: roomId, case_id: caseId, teacher_name: teacher, state: "case", current_step: "pending" }])
    .select();

  if (error) {
    console.error("Supabase createSession error:", error);
    throw error;
  }
  return data[0];
}

async function loadSession(roomId) {
  const { data, error } = await supabaseClient.from("sessions").select("*").eq("room_id", roomId).single();
  if (error) {
    console.warn("Supabase loadSession error:", error);
    return null;
  }
  return data;
}

async function updateSession(roomId, updates) {
  const { data, error } = await supabaseClient
    .from("sessions")
    .update(updates)
    .eq("room_id", roomId)
    .select()
    .single();

  if (error) {
    console.error("Supabase updateSession error:", error);
    throw error;
  }
  return data;
}

async function joinRoom(roomId, student) {
  const { data, error } = await supabaseClient
    .from("participants")
    .upsert([
      {
        room_id: roomId,
        name: student.name,
        student_code: student.studentCode || null,
        connected: true,
      },
    ], { onConflict: ["room_id", "name"] })
    .select();

  if (error) {
    console.error("Supabase joinRoom error:", error);
    throw error;
  }
  return data[0];
}

async function submitVote(roomId, participantId, optionKey) {
  const { data, error } = await supabaseClient.from("votes").insert([
    {
      room_id: roomId,
      participant_id: participantId,
      option_key: optionKey,
    },
  ]);

  if (error) {
    console.error("Supabase submitVote error:", error);
    throw error;
  }
  return data[0];
}

async function fetchParticipants(roomId) {
  const { data, error } = await supabaseClient
    .from("participants")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });

  if (error) {
    console.warn("Supabase fetchParticipants error:", error);
    return [];
  }
  return data;
}

async function fetchVotes(roomId) {
  const { data, error } = await supabaseClient.from("votes").select("*").eq("room_id", roomId);
  if (error) {
    console.warn("Supabase fetchVotes error:", error);
    return [];
  }
  return data;
}

function subscribeSession(roomId, callback) {
  return supabaseClient
    .channel(`session:${roomId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `room_id=eq.${roomId}` }, payload => {
      callback(payload.new);
    })
    .subscribe();
}

function subscribeParticipants(roomId, callback) {
  return supabaseClient
    .channel(`participants:${roomId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` }, payload => {
      callback(payload.new);
    })
    .subscribe();
}

function normalizeCaseRecord(record) {
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    brief: record.brief,
    introduction: record.introduction,
    dilemma: record.dilemma,
    imageUrl: record.image_url,
    animationUrl: record.animation_url,
    decisions: record.decisions || [],
    reflection: record.reflection,
    bibliography: record.bibliography,
    createdAt: record.created_at,
  };
}

function generateRoomCode() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => charset[Math.floor(Math.random() * charset.length)]).join("");
}
