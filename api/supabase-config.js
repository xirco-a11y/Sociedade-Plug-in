module.exports = (req, res) => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({
      error: "Faltam SUPABASE_URL e/ou SUPABASE_ANON_KEY nas variaveis da Vercel."
    });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    supabaseUrl: "https://brgjnctlpxcbrixsthgs.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZ2puY3RscHhjYnJpeHN0aGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTA4MDAsImV4cCI6MjA5MTEyNjgwMH0.bXQmdUnx4rYzgu-bcG9I2iRWQiBouI-tce4sPkmY-1k"
  });
};
