(function () {
  const page = document.body.dataset.page;
  const cfg = window.APP_CONFIG || {};
  const ready = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR-PROJECT') && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('YOUR_');

  if (!ready) {
    renderConfigWarning();
    return;
  }

  const supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const state = {
    session: null,
    profile: null,
    genres: [],
    songs: [],
    artists: []
  };

  init();

  async function init() {
    const { data } = await supabase.auth.getSession();
    state.session = data.session || null;
    if (state.session) {
      await loadProfile();
    }
    renderNav();

    if (page === 'home') await initHome();
    if (page === 'song') await initSong();
    if (page === 'login') await initLogin();
    if (page === 'account') await initAccount();
    if (page === 'admin') await initAdmin();

    supabase.auth.onAuthStateChange(async (_event, session) => {
      state.session = session;
      if (session) await loadProfile(); else state.profile = null;
      renderNav();
    });
  }

  function renderConfigWarning() {
    document.body.innerHTML = `
      <div class="auth-layout">
        <div class="panel">
          <div class="brand" style="display:flex;margin-bottom:14px;">
            <div class="logo"></div>
            <div class="brand-text">
              <h1>Moins Commun Reprise</h1>
              <p>Configuration manquante</p>
            </div>
          </div>
          <div class="notice error">
            Remplace les valeurs de <strong>public/config.js</strong> avec ton URL Supabase et ta clé anon, puis recharge la page.
          </div>
        </div>
      </div>`;
  }

  async function loadProfile() {
    const userId = state.session?.user?.id;
    if (!userId) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    state.profile = data || null;
  }

  function renderNav() {
    const nav = document.getElementById('navLinks');
    if (!nav) return;
    const links = [`<a href="/">Accueil</a>`];
    if (state.session) {
      links.push(`<a href="/account">Mon compte</a>`);
      if (state.profile?.is_admin) links.push(`<a href="/admin">Admin</a>`);
      links.push(`<button id="logoutBtn">Déconnexion</button>`);
    } else {
      links.push(`<a href="/login">Connexion</a>`);
    }
    nav.innerHTML = links.join('');
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = async () => {
      await supabase.auth.signOut();
      window.location.href = '/';
    };
  }

  async function initHome() {
    await loadGenres();
    await searchSongs();
    document.getElementById('searchBtn').onclick = searchSongs;
    document.getElementById('resetBtn').onclick = async () => {
      document.getElementById('searchInput').value = '';
      document.getElementById('genreFilter').value = '';
      document.getElementById('yearFilter').value = '';
      await searchSongs();
    };
  }

  async function loadGenres() {
    const { data } = await supabase.from('songs').select('genre').not('genre', 'is', null);
    const genres = [...new Set((data || []).map(x => x.genre).filter(Boolean))].sort();
    state.genres = genres;
    const select = document.getElementById('genreFilter');
    if (select) select.innerHTML = `<option value="">Tous</option>${genres.map(g => `<option>${escapeHtml(g)}</option>`).join('')}`;
  }

  async function searchSongs() {
    const q = document.getElementById('searchInput')?.value?.trim() || '';
    const genre = document.getElementById('genreFilter')?.value || '';
    const year = document.getElementById('yearFilter')?.value || '';

    let query = supabase.from('song_details').select('*').order('created_at', { ascending: false }).limit(48);
    if (genre) query = query.eq('genre', genre);
    if (year) query = query.eq('year', Number(year));
    if (q) query = query.or(`title.ilike.%${q}%,artist_name.ilike.%${q}%,genre.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) return showGridError('songsGrid', error.message);
    state.songs = data || [];
    renderSongs(state.songs, document.getElementById('songsGrid'));
    const count = document.getElementById('resultsCount');
    if (count) count.textContent = `${state.songs.length} résultat(s)`;
  }

  function renderSongs(songs, container, favoriteIds = []) {
    if (!container) return;
    if (!songs.length) {
      container.innerHTML = `<div class="notice">Aucun morceau trouvé.</div>`;
      return;
    }
    container.innerHTML = songs.map(song => `
      <article class="card">
        <div class="card-cover">
          ${song.cover_url ? `<img src="${escapeHtml(song.cover_url)}" alt="${escapeHtml(song.title)}">` : `<div class="placeholder-art">?</div>`}
        </div>
        <div class="card-body">
          <h4>${escapeHtml(song.title)}</h4>
          <div class="meta">${escapeHtml(song.artist_name)}${song.year ? ` • ${song.year}` : ''}${song.genre ? ` • ${escapeHtml(song.genre)}` : ''}</div>
          <p class="muted">${escapeHtml(song.description || 'Aucune description pour le moment.')}</p>
          <div class="card-actions">
            <a class="btn" href="/song?id=${song.id}">Voir la fiche</a>
            ${state.session ? `<button class="mini-btn fav-btn" data-song-id="${song.id}">${favoriteIds.includes(song.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}</button>` : ''}
          </div>
        </div>
      </article>`).join('');

    container.querySelectorAll('.fav-btn').forEach(btn => {
      btn.onclick = async () => {
        const songId = btn.dataset.songId;
        await toggleFavorite(songId);
        if (page === 'home') await searchSongs();
        if (page === 'account') await initAccount();
      };
    });
  }

  async function initSong() {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (!id) return;

    const [{ data: song }, { data: relations }] = await Promise.all([
      supabase.from('song_details').select('*').eq('id', id).maybeSingle(),
      supabase.from('song_relationships').select('id, relation_type, note, source_song_id, target_song_id').or(`source_song_id.eq.${id},target_song_id.eq.${id}`)
    ]);

    const root = document.getElementById('songDetail');
    if (!song) {
      root.innerHTML = `<div class="notice error">Morceau introuvable.</div>`;
      return;
    }

    const relatedIds = [...new Set((relations || []).flatMap(r => [r.source_song_id, r.target_song_id]).filter(x => x !== id))];
    let relatedSongsMap = new Map();
    if (relatedIds.length) {
      const { data: relatedSongs } = await supabase.from('song_details').select('*').in('id', relatedIds);
      relatedSongsMap = new Map((relatedSongs || []).map(s => [s.id, s]));
    }

    root.innerHTML = `
      <div class="detail-grid">
        <div class="detail-cover">${song.cover_url ? `<img src="${escapeHtml(song.cover_url)}" alt="${escapeHtml(song.title)}">` : `<div class="placeholder-art" style="min-height:330px;">?</div>`}</div>
        <div class="panel">
          <span class="badge">${song.genre || 'Genre inconnu'}</span>
          <h2 style="margin:14px 0 8px; font-size:42px;">${escapeHtml(song.title)}</h2>
          <p class="muted">${escapeHtml(song.artist_name)}${song.year ? ` • ${song.year}` : ''}</p>
          <p>${escapeHtml(song.description || 'Pas encore de description.')}</p>
          <div class="actions">
            ${song.youtube_url ? `<a class="btn" href="${escapeHtml(song.youtube_url)}" target="_blank" rel="noreferrer">Écouter</a>` : ''}
            ${state.session ? `<button class="btn secondary" id="favoriteSongBtn">Ajouter / retirer des favoris</button>` : `<a class="btn secondary" href="/login">Se connecter</a>`}
          </div>
        </div>
      </div>
      <section class="section">
        <div class="panel">
          <div class="section-head"><h3>Relations</h3></div>
          <div class="list" id="relationsList"></div>
        </div>
      </section>`;

    const list = document.getElementById('relationsList');
    if (!relations?.length) {
      list.innerHTML = `<div class="notice">Aucune relation enregistrée pour ce morceau.</div>`;
    } else {
      list.innerHTML = relations.map(rel => {
        const otherId = rel.source_song_id === id ? rel.target_song_id : rel.source_song_id;
        const otherSong = relatedSongsMap.get(otherId);
        const direction = rel.source_song_id === id ? 'vers' : 'depuis';
        return `<div class="list-item"><div><strong>${escapeHtml(rel.relation_type)}</strong> ${direction} <a href="/song?id=${otherId}">${escapeHtml(otherSong?.title || 'Morceau')}</a><div class="muted">${escapeHtml(otherSong?.artist_name || '')}${rel.note ? ` • ${escapeHtml(rel.note)}` : ''}</div></div></div>`;
      }).join('');
    }

    const favBtn = document.getElementById('favoriteSongBtn');
    if (favBtn) favBtn.onclick = async () => {
      await toggleFavorite(id);
      alert('Favoris mis à jour.');
    };
  }

  async function initLogin() {
    const notice = document.getElementById('authNotice');
    document.getElementById('loginBtn').onclick = async () => {
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value.trim();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setNotice(notice, error ? error.message : 'Connexion réussie.', !error);
      if (!error) setTimeout(() => window.location.href = '/account', 700);
    };

    document.getElementById('signupBtn').onclick = async () => {
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value.trim();
      const username = document.getElementById('authUsername').value.trim() || email.split('@')[0];
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, display_name: username } }
      });
      setNotice(notice, error ? error.message : 'Compte créé. Vérifie ton email si la confirmation est activée.', !error);
    };
  }

  async function initAccount() {
    if (!state.session) {
      window.location.href = '/login';
      return;
    }
    const [{ count: favCount }, { data: favs }] = await Promise.all([
      supabase.from('favorites').select('*', { count: 'exact', head: true }).eq('user_id', state.session.user.id),
      supabase.from('favorites').select('song_id').eq('user_id', state.session.user.id)
    ]);
    const favoriteIds = (favs || []).map(f => f.song_id);

    let songs = [];
    if (favoriteIds.length) {
      const { data } = await supabase.from('song_details').select('*').in('id', favoriteIds);
      songs = data || [];
    }

    document.getElementById('accountStats').innerHTML = `
      <div class="stat"><span class="muted">Utilisateur</span><strong>${escapeHtml(state.profile?.username || state.session.user.email)}</strong></div>
      <div class="stat"><span class="muted">Favoris</span><strong>${favCount || 0}</strong></div>
      <div class="stat"><span class="muted">Rôle</span><strong>${state.profile?.is_admin ? 'Admin' : 'Membre'}</strong></div>
      <div class="stat"><span class="muted">Email</span><strong style="font-size:20px">${escapeHtml(state.session.user.email || '')}</strong></div>`;
    renderSongs(songs, document.getElementById('favoritesGrid'), favoriteIds);
  }

  async function initAdmin() {
    if (!state.session) {
      window.location.href = '/login';
      return;
    }
    const notice = document.getElementById('adminAccessNotice');
    if (!state.profile?.is_admin) {
      setNotice(notice, 'Accès refusé. Passe ton profil en is_admin = true dans Supabase.', false);
      return;
    }
    notice.classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');

    await Promise.all([loadAdminStats(), loadArtists(), loadSongsForAdmin()]);

    document.getElementById('createArtistBtn').onclick = createArtist;
    document.getElementById('createSongBtn').onclick = createSong;
    document.getElementById('createRelationBtn').onclick = createRelation;
  }

  async function loadAdminStats() {
    const [{ count: artistsCount }, { count: songsCount }, { count: relCount }, { count: usersCount }] = await Promise.all([
      supabase.from('artists').select('*', { count: 'exact', head: true }),
      supabase.from('songs').select('*', { count: 'exact', head: true }),
      supabase.from('song_relationships').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true })
    ]);
    document.getElementById('adminStats').innerHTML = `
      <div class="stat"><span class="muted">Artistes</span><strong>${artistsCount || 0}</strong></div>
      <div class="stat"><span class="muted">Morceaux</span><strong>${songsCount || 0}</strong></div>
      <div class="stat"><span class="muted">Relations</span><strong>${relCount || 0}</strong></div>
      <div class="stat"><span class="muted">Utilisateurs</span><strong>${usersCount || 0}</strong></div>`;
  }

  async function loadArtists() {
    const { data } = await supabase.from('artists').select('*').order('name');
    state.artists = data || [];
    const html = state.artists.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    const select = document.getElementById('songArtist');
    if (select) select.innerHTML = html;
  }

  async function loadSongsForAdmin() {
    const { data } = await supabase.from('song_details').select('*').order('created_at', { ascending: false });
    state.songs = data || [];
    const options = state.songs.map(s => `<option value="${s.id}">${escapeHtml(s.title)} — ${escapeHtml(s.artist_name)}</option>`).join('');
    const source = document.getElementById('relationSource');
    const target = document.getElementById('relationTarget');
    if (source) source.innerHTML = options;
    if (target) target.innerHTML = options;

    const tbody = document.getElementById('adminSongsTable');
    if (tbody) {
      tbody.innerHTML = state.songs.map(song => `
        <tr>
          <td>${escapeHtml(song.title)}</td>
          <td>${escapeHtml(song.artist_name)}</td>
          <td>${song.year || ''}</td>
          <td>${escapeHtml(song.genre || '')}</td>
          <td><button class="mini-btn delete-song" data-id="${song.id}">Supprimer</button></td>
        </tr>`).join('');
      tbody.querySelectorAll('.delete-song').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Supprimer ce morceau ?')) return;
          const { error } = await supabase.from('songs').delete().eq('id', btn.dataset.id);
          if (error) return alert(error.message);
          await Promise.all([loadAdminStats(), loadSongsForAdmin()]);
        };
      });
    }
  }

  async function createArtist() {
    const payload = {
      name: document.getElementById('artistName').value.trim(),
      country: document.getElementById('artistCountry').value.trim() || null,
      bio: document.getElementById('artistBio').value.trim() || null
    };
    const { error } = await supabase.from('artists').insert(payload);
    if (error) return alert(error.message);
    alert('Artiste ajouté.');
    document.getElementById('artistName').value = '';
    document.getElementById('artistCountry').value = '';
    document.getElementById('artistBio').value = '';
    await Promise.all([loadAdminStats(), loadArtists()]);
  }

  async function createSong() {
    const title = document.getElementById('songTitle').value.trim();
    const artistId = document.getElementById('songArtist').value;
    const year = document.getElementById('songYear').value || null;
    const genre = document.getElementById('songGenre').value.trim() || null;
    const youtube = document.getElementById('songYoutube').value.trim() || null;
    const description = document.getElementById('songDescription').value.trim() || null;
    const file = document.getElementById('songCover').files[0];

    let coverUrl = null;
    if (file) {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('covers').upload(path, file, { upsert: false });
      if (uploadError) return alert(uploadError.message + ' — vérifie que le bucket covers existe et que les policies Storage sont bien configurées.');
      const { data } = supabase.storage.from('covers').getPublicUrl(path);
      coverUrl = data.publicUrl;
    }

    const { error } = await supabase.from('songs').insert({
      title,
      artist_id: artistId,
      year: year ? Number(year) : null,
      genre,
      youtube_url: youtube,
      description,
      cover_url: coverUrl,
      created_by: state.session.user.id
    });
    if (error) return alert(error.message);
    alert('Morceau ajouté.');
    ['songTitle','songYear','songGenre','songYoutube','songDescription','songCover'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    await Promise.all([loadAdminStats(), loadSongsForAdmin()]);
  }

  async function createRelation() {
    const payload = {
      source_song_id: document.getElementById('relationSource').value,
      target_song_id: document.getElementById('relationTarget').value,
      relation_type: document.getElementById('relationType').value,
      note: document.getElementById('relationNote').value.trim() || null
    };
    const { error } = await supabase.from('song_relationships').insert(payload);
    if (error) return alert(error.message);
    alert('Relation ajoutée.');
    document.getElementById('relationNote').value = '';
    await loadAdminStats();
  }

  async function toggleFavorite(songId) {
    if (!state.session) {
      window.location.href = '/login';
      return;
    }
    const userId = state.session.user.id;
    const { data } = await supabase.from('favorites').select('*').eq('user_id', userId).eq('song_id', songId).maybeSingle();
    if (data) {
      await supabase.from('favorites').delete().eq('user_id', userId).eq('song_id', songId);
    } else {
      await supabase.from('favorites').insert({ user_id: userId, song_id: songId });
    }
  }

  function setNotice(el, text, ok) {
    el.textContent = text;
    el.className = `notice ${ok ? 'ok' : 'error'}`;
  }

  function showGridError(id, message) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="notice error">${escapeHtml(message)}</div>`;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
})();
