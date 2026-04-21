(function () {
  const { createClient } = window.supabase;
  const config = window.APP_CONFIG;
  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

  async function signUp({ email, password, username }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });

    if (error) throw error;
    return data;
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function getCurrentProfile() {
    const session = await getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) throw error;
    return data;
  }

  async function updateProfile({ username, bio, avatarFile }) {
    const session = await getSession();
    if (!session?.user) throw new Error('Non connecté');

    let avatar_url = null;

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop();
      const filePath = `${session.user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      avatar_url = publicUrlData.publicUrl;
    }

    const payload = {
      username,
      bio
    };

    if (avatar_url) payload.avatar_url = avatar_url;

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', session.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  window.MoinsCommunAuth = {
    supabase,
    signUp,
    signIn,
    signOut,
    getSession,
    getCurrentProfile,
    updateProfile
  };
})();
