const cfg = window.APP_CONFIG || {};
const SUPABASE_URL = cfg.SUPABASE_URL;
const SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Config Supabase manquante.');
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  session: null,
  profile: null,
  favorites: new Set()
};

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getSearchParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function songHref(id) {
  return `/song?id=${id}`;
}

function formatCover() {
  return '';
}

function relationshipLabel(type) {
  const map = {
    sampled: 'sample de',
    sampled_by: 'samplé par',
    cover_of: 'reprise de',
    covered_by: 'repris par',
    remix_of: 'remix de',
    remixed_by: 'remixé par',
    interpolation_of: 'interpolation de',
    interpolated_by: 'interpolé par'
  };
  return map[type] || type;
}

function renderListeningLinks(song) {
  const links = [];

  if (song.spotify_url) {
    links.push(`<a class="btn small" href="${escapeHtml(song.spotify_url)}" target="_blank" rel="noopener">Spotify</a>`);
  }

  if (song.youtube_url) {
    links.push(`<a class="btn small secondary" href="${escapeHtml(song.youtube_url)}" target="_blank" rel="noopener">YouTube</a>`);
  }

  if (song.apple_music_url) {
    links.push(`<a class="btn small secondary" href="${escapeHtml(song.apple_music_url)}" target="_blank" rel="noopener">Apple Music</a>`);
  }

  if (song.soundcloud_url) {
    links.push(`<a class="btn small secondary" href="${escapeHtml(song.soundcloud_url)}" target="_blank" rel="noopener">SoundCloud</a>`);
  }

  return links.length
    ? links.join('')
    : '<div class="helper">Aucun lien disponible</div>';
}

function renderPreviewPlayer(song) {
  if (!song.preview_url) return '';

  return `
    <audio controls style="width:100%;">
      <source src="${escapeHtml(song.preview_url)}" type="audio/mpeg">
      Ton navigateur ne supporte pas l’audio.
    </audio>
  `;
}

function relationshipOptions() {
  return `
    <option value="sampled">sample de</option>
    <option value="sampled_by">samplé par</option>
    <option value="cover_of">reprise de</option>
    <option value="covered_by">repris par</option>
    <option value="remix_of">remix de</option>
    <option value="remixed_by">remixé par</option>
    <option value="interpolation_of">interpolation de</option>
    <option value="interpolated_by">interpolé par</option>
  `;
}

async function loadSession() {
  const { data } = await supabaseClient.auth.getSession();
  state.session = data.session || null;
  if (state.session) {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', state.session.user.id)
      .maybeSingle();
    state.profile = profile || null;
    await loadFavorites();
  } else {
    state.profile = null;
    state.favorites = new Set();
  }
  renderTopbarUser();
  return state.session;
}

async function loadFavorites() {
  if (!state.session) return;
  const { data, error } = await supabaseClient
    .from('favorites')
    .select('song_id')
    .eq('user_id', state.session.user.id);
  if (!error) {
    state.favorites = new Set((data || []).map((f) => f.song_id));
  }
}

function renderTopbarUser() {
  const mount = qs('[data-user-nav]');
  if (!mount) return;
  const links = [`<a href="/">Accueil</a>`];
  if (state.session) {
    links.push(`<a href="/favorites">Favoris</a>`);
    links.push(`<a href="/submit">Ajouter un morceau</a>`);
    if (state.profile?.is_admin) links.push(`<a href="/admin">Admin</a>`);
    links.push(`<button id="logoutBtn">Déconnexion</button>`);
  } else {
    links.push(`<a href="/login">Connexion</a>`);
  }
  mount.innerHTML = links.join('');
  qs('#logoutBtn')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.href = '/';
  });
}

function songCard(song) {
  const isFavorite = state.favorites.has(song.id);
  return `
    <article class="card">
      <div class="spread">
        <div>
          <h3>${escapeHtml(song.title)}</h3>
          <div class="meta">${escapeHtml(song.artist_name || 'Artiste inconnu')} • ${escapeHtml(song.release_year || '—')} • ${escapeHtml(song.genre || 'Genre libre')}</div>
        </div>
        <button class="btn small secondary favorite-toggle" data-song-id="${song.id}" aria-label="favori">
          ${isFavorite ? '♥' : '♡'}
        </button>
      </div>
      <p>${escapeHtml(song.description || 'Aucune description pour le moment.')}</p>
      <div class="row">
        <a class="btn small" href="${songHref(song.id)}">Voir la fiche</a>
        ${song.status ? `<span class="tag">${escapeHtml(song.status)}</span>` : ''}
      </div>
    </article>
  `;
}

async function toggleFavorite(songId) {
  if (!state.session) {
    location.href = '/login';
    return;
  }
  const id = Number(songId);
  if (state.favorites.has(id)) {
    await supabaseClient.from('favorites').delete().eq('user_id', state.session.user.id).eq('song_id', id);
    state.favorites.delete(id);
  } else {
    await supabaseClient.from('favorites').insert({ user_id: state.session.user.id, song_id: id });
    state.favorites.add(id);
  }
  qsa(`.favorite-toggle[data-song-id="${id}"]`).forEach((btn) => {
    btn.textContent = state.favorites.has(id) ? '♥' : '♡';
  });
}

document.addEventListener('click', (event) => {
  const btn = event.target.closest('.favorite-toggle');
  if (btn) toggleFavorite(btn.dataset.songId);
});

async function bootHome() {
  await loadSession();
  const mount = qs('#songsGrid');
  const errorMount = qs('#homeError');
  const genreSelect = qs('#genreFilter');
  if (!mount) return;

  const { data: genres } = await supabaseClient
    .from('songs')
    .select('genre')
    .eq('status', 'published')
    .order('genre');
  const uniqueGenres = [...new Set((genres || []).map((g) => g.genre).filter(Boolean))];
  genreSelect.innerHTML = '<option value="">Tous</option>' + uniqueGenres.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');

  async function loadSongs() {
    errorMount.classList.add('hidden');
    mount.innerHTML = '<p class="helper">Chargement…</p>';
    let query = supabaseClient
      .from('song_details')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    const search = qs('#searchInput')?.value.trim();
    const genre = qs('#genreFilter')?.value;
    const year = qs('#yearFilter')?.value.trim();

    if (genre) query = query.eq('genre', genre);
    if (year) query = query.eq('release_year', Number(year));

    const { data, error } = await query;
    if (error) {
      mount.innerHTML = '';
      errorMount.textContent = error.message;
      errorMount.classList.remove('hidden');
      return;
    }

    let rows = data || [];
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((row) => [row.title, row.artist_name, row.genre, row.description].join(' ').toLowerCase().includes(s));
    }

    if (!rows.length) {
      mount.innerHTML = '<div class="empty-state">Aucun morceau trouvé.</div>';
      return;
    }
    mount.innerHTML = rows.map(songCard).join('');
  }

  qs('#searchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    loadSongs();
  });
  qs('#resetFilters')?.addEventListener('click', () => {
    qs('#searchForm').reset();
    loadSongs();
  });

  await loadSongs();
}

async function bootSongPage() {
  await loadSession();
  const songId = Number(getSearchParam('id'));
  if (!songId) return;

  const titleMount = qs('#songTitle');
  const coverMount = qs('#songCover');
  const metaMount = qs('#songMeta');
  const descMount = qs('#songDescription');
  const relationshipsMount = qs('#relationshipsList');
  const listeningMount = qs('#songListening');
  const previewMount = qs('#songPreviewPlayer');

  const { data: song, error } = await supabaseClient
    .from('song_details')
    .select('*')
    .eq('id', songId)
    .maybeSingle();

  if (error || !song) {
    titleMount.textContent = 'Morceau introuvable';
    if (listeningMount) listeningMount.innerHTML = '';
    if (previewMount) previewMount.innerHTML = '';
    return;
  }

  document.title = `${song.title} — Moins Commun`;
  titleMount.textContent = song.title;

  if (coverMount) {
    coverMount.innerHTML = formatCover(song.cover_url);
  }

  metaMount.innerHTML = `
    <div class="tag">${escapeHtml(song.artist_name || 'Artiste inconnu')}</div>
    <div class="tag">${escapeHtml(song.release_year || '—')}</div>
    <div class="tag">${escapeHtml(song.genre || 'Genre libre')}</div>
  `;
  descMount.textContent = song.description || 'Aucune description.';
  qs('#songFavorite').dataset.songId = song.id;
  qs('#songFavorite').textContent = state.favorites.has(song.id) ? '♥ Ajouter aux favoris' : '♡ Ajouter aux favoris';

  if (listeningMount) {
    listeningMount.innerHTML = renderListeningLinks(song);
  }

  if (previewMount) {
    previewMount.innerHTML = renderPreviewPlayer(song);
  }

  const { data: relations } = await supabaseClient
    .from('song_relationships')
    .select('id, relation_type, notes, related_song_id, songs!song_relationships_related_song_id_fkey(id, title, cover_url), primary_song_id')
    .eq('primary_song_id', songId)
    .order('created_at', { ascending: false });

  if (!relations?.length) {
    relationshipsMount.innerHTML = '<div class="empty-state">Aucune relation renseignée pour ce morceau.</div>';
  } else {
    relationshipsMount.innerHTML = relations.map((rel) => `
      <div class="list-item">
        <div class="spread">
          <strong>${relationshipLabel(rel.relation_type)}</strong>
          <a class="btn small secondary" href="${songHref(rel.songs.id)}">Voir</a>
        </div>
        <div class="meta">${escapeHtml(rel.songs.title)}</div>
        ${rel.notes ? `<p>${escapeHtml(rel.notes)}</p>` : ''}
      </div>
    `).join('');
  }
}

async function bootLoginPage() {
  await loadSession();
  if (state.session) {
    qs('#authStatus').innerHTML = `<div class="empty-state">Tu es déjà connecté avec <strong>${escapeHtml(state.session.user.email)}</strong>.</div>`;
  }

  qs('#loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = qs('#loginEmail').value.trim();
    const password = qs('#loginPassword').value.trim();
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    const mount = qs('#authStatus');
    if (error) {
      mount.innerHTML = `<div class="notice">${escapeHtml(error.message)}</div>`;
      return;
    }
    location.href = '/';
  });

  qs('#signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = qs('#signupEmail').value.trim();
    const password = qs('#signupPassword').value.trim();
    const username = qs('#signupUsername').value.trim();
    const mount = qs('#authStatus');
    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    if (error) {
      mount.innerHTML = `<div class="notice">${escapeHtml(error.message)}</div>`;
      return;
    }
    mount.innerHTML = `<div class="empty-state">Compte créé. Vérifie ton email si la confirmation est activée dans Supabase.</div>`;
  });
}

async function bootSubmitPage() {
  await loadSession();
  const mount = qs('#submitStatus');
  if (!state.session) {
    mount.innerHTML = `<div class="notice">Connecte-toi pour proposer un morceau.</div>`;
    return;
  }

  const { data: artists } = await supabaseClient.from('artists').select('id, name').order('name');
  const songSelect = qs('#relatedSongId');
  const artistSelect = qs('#artistId');
  const { data: songs } = await supabaseClient.from('songs').select('id, title').eq('status', 'published').order('title');

  songSelect.innerHTML = '<option value="">Aucune relation</option>' + (songs || []).map(s => `<option value="${s.id}">${escapeHtml(s.title)}</option>`).join('');
  artistSelect.innerHTML = '<option value="">Créer / choisir plus tard</option>' + (artists || []).map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  qs('#relationType').innerHTML = `<option value="">Choisir un type</option>${relationshipOptions()}`;

  qs('#submissionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    mount.innerHTML = '';

    const payload = {
      title: qs('#title').value.trim(),
      artist_id: qs('#artistId').value ? Number(qs('#artistId').value) : null,
      artist_name_text: qs('#artistNameText').value.trim() || null,
      release_year: qs('#releaseYear').value ? Number(qs('#releaseYear').value) : null,
      genre: qs('#genre').value.trim() || null,
      description: qs('#description').value.trim() || null,
      cover_url: qs('#coverUrl').value.trim() || null,
      spotify_url: qs('#spotifyUrl')?.value.trim() || null,
      youtube_url: qs('#youtubeUrl')?.value.trim() || null,
      apple_music_url: qs('#appleMusicUrl')?.value.trim() || null,
      soundcloud_url: qs('#soundcloudUrl')?.value.trim() || null,
      preview_url: qs('#previewUrl')?.value.trim() || null,
      relation_type: qs('#relationType').value || null,
      related_song_id: qs('#relatedSongId').value ? Number(qs('#relatedSongId').value) : null
    };

    const { error } = await supabaseClient
      .from('song_submissions')
      .insert({
        user_id: state.session.user.id,
        ...payload
      });

    if (error) {
      mount.innerHTML = `<div class="notice">${escapeHtml(error.message)}</div>`;
      return;
    }

    mount.innerHTML = `<div class="empty-state">Proposition envoyée. Un admin peut maintenant la valider.</div>`;
    qs('#submissionForm').reset();
  });
}

async function bootFavoritesPage() {
  await loadSession();
  const mount = qs('#favoritesGrid');
  if (!mount) return;
  if (!state.session) {
    mount.innerHTML = '<div class="notice">Connecte-toi pour voir tes favoris.</div>';
    return;
  }

  const { data, error } = await supabaseClient
    .from('favorites')
    .select('song_id, songs:song_id(id, title, cover_url, description, release_year, genre, artist_id, artists:artist_id(name))')
    .eq('user_id', state.session.user.id);

  if (error) {
    mount.innerHTML = `<div class="notice">${escapeHtml(error.message)}</div>`;
    return;
  }

  const rows = (data || []).map((item) => ({
    ...item.songs,
    artist_name: item.songs?.artists?.name
  })).filter(Boolean);

  mount.innerHTML = rows.length ? rows.map(songCard).join('') : '<div class="empty-state">Tu n’as encore aucun favori.</div>';
}

async function bootAdminPage() {
  await loadSession();
  const gate = qs('#adminGate');
  const shell = qs('#adminShell');

  if (!state.session || !state.profile?.is_admin) {
    gate.innerHTML = '<div class="notice">Accès admin requis.</div>';
    return;
  }
  gate.remove();
  shell.classList.remove('hidden');

  qsa('.tab-btn').forEach((btn) => btn.addEventListener('click', () => {
    qsa('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    qsa('[data-tab-panel]').forEach((panel) => panel.classList.add('hidden'));
    qs(`#tab-${btn.dataset.tab}`).classList.remove('hidden');
  }));

  const [songsRes, artistsRes, submissionsRes, relRes, profilesRes] = await Promise.all([
    supabaseClient.from('song_details').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('artists').select('*').order('name'),
    supabaseClient.from('song_submissions').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('song_relationships').select('*, primary_song:songs!song_relationships_primary_song_id_fkey(title), related_song:songs!song_relationships_related_song_id_fkey(title)').order('created_at', { ascending: false }),
    supabaseClient.from('profiles').select('*').order('created_at', { ascending: false })
  ]);

  qs('#songsTableBody').innerHTML = (songsRes.data || []).map((song) => `
    <tr>
      <td>${song.id}</td>
      <td>${escapeHtml(song.title)}</td>
      <td>${escapeHtml(song.artist_name || '')}</td>
      <td>${escapeHtml(song.status || '')}</td>
      <td>
        <div class="row">
          <button class="btn small secondary admin-song-status" data-id="${song.id}" data-status="${song.status === 'published' ? 'draft' : 'published'}">
            ${song.status === 'published' ? 'Passer en brouillon' : 'Publier'}
          </button>
          <button class="btn small danger admin-song-delete" data-id="${song.id}">Supprimer</button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5">Aucun morceau</td></tr>';

  qs('#artistsTableBody').innerHTML = (artistsRes.data || []).map((artist) => `
    <tr>
      <td>${artist.id}</td>
      <td>${escapeHtml(artist.name)}</td>
      <td>${escapeHtml(artist.country || '')}</td>
      <td>${escapeHtml(artist.bio || '')}</td>
    </tr>
  `).join('') || '<tr><td colspan="4">Aucun artiste</td></tr>';

  qs('#usersTableBody').innerHTML = (profilesRes.data || []).map((profile) => `
    <tr>
      <td>${escapeHtml(profile.username || '')}</td>
      <td>${profile.is_admin ? 'Oui' : 'Non'}</td>
      <td>${escapeHtml(profile.created_at || '')}</td>
      <td>
        <button class="btn small secondary admin-user-role" data-id="${profile.id}" data-admin="${profile.is_admin ? 'false' : 'true'}">
          ${profile.is_admin ? 'Retirer admin' : 'Rendre admin'}
        </button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="4">Aucun utilisateur</td></tr>';

  qs('#relationsTableBody').innerHTML = (relRes.data || []).map((rel) => `
    <tr>
      <td>${escapeHtml(rel.primary_song?.title || '')}</td>
      <td>${escapeHtml(relationshipLabel(rel.relation_type))}</td>
      <td>${escapeHtml(rel.related_song?.title || '')}</td>
      <td>${escapeHtml(rel.notes || '')}</td>
      <td><button class="btn small danger admin-rel-delete" data-id="${rel.id}">Supprimer</button></td>
    </tr>
  `).join('') || '<tr><td colspan="5">Aucune relation</td></tr>';

  const songOptions = (songsRes.data || []).map((song) => `<option value="${song.id}">${escapeHtml(song.title)}</option>`).join('');
  qs('#adminPrimarySong').innerHTML = `<option value="">Choisir</option>${songOptions}`;
  qs('#adminRelatedSong').innerHTML = `<option value="">Choisir</option>${songOptions}`;
  qs('#adminRelationType').innerHTML = relationshipOptions();

  qs('#submissionsTableBody').innerHTML = (submissionsRes.data || []).map((sub) => `
    <tr>
      <td>${escapeHtml(sub.title)}</td>
      <td>${escapeHtml(sub.artist_name_text || '')}</td>
      <td>${escapeHtml(sub.genre || '')}</td>
      <td>${escapeHtml(sub.created_at || '')}</td>
      <td>
        <div class="row">
          <button class="btn small success admin-sub-approve" data-id="${sub.id}">Valider</button>
          <button class="btn small danger admin-sub-reject" data-id="${sub.id}">Refuser</button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5">Aucune proposition</td></tr>';

  qs('#adminAddArtistForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: qs('#adminArtistName').value.trim(),
      country: qs('#adminArtistCountry').value.trim() || null,
      bio: qs('#adminArtistBio').value.trim() || null
    };
    const { error } = await supabaseClient.from('artists').insert(payload);
    qs('#adminStatus').innerHTML = error ? `<div class="notice">${escapeHtml(error.message)}</div>` : `<div class="empty-state">Artiste ajouté. Recharge la page admin.</div>`;
  });

  qs('#adminAddRelationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await supabaseClient.from('song_relationships').insert({
      primary_song_id: Number(qs('#adminPrimarySong').value),
      related_song_id: Number(qs('#adminRelatedSong').value),
      relation_type: qs('#adminRelationType').value,
      notes: qs('#adminRelationNotes').value.trim() || null,
      created_by: state.session.user.id
    });
    qs('#adminStatus').innerHTML = error ? `<div class="notice">${escapeHtml(error.message)}</div>` : `<div class="empty-state">Relation ajoutée. Recharge la page admin.</div>`;
  });

  document.addEventListener('click', async (event) => {
    const publishBtn = event.target.closest('.admin-song-status');
    if (publishBtn) {
      const { error } = await supabaseClient
        .from('songs')
        .update({ status: publishBtn.dataset.status })
        .eq('id', publishBtn.dataset.id);

      qs('#adminStatus').innerHTML = error
        ? `<div class="notice">${escapeHtml(error.message)}</div>`
        : `<div class="empty-state">Statut mis à jour. Recharge la page admin.</div>`;
    }

    const deleteBtn = event.target.closest('.admin-song-delete');
    if (deleteBtn && confirm('Supprimer ce morceau ?')) {
      const { error } = await supabaseClient.from('songs').delete().eq('id', deleteBtn.dataset.id);
      qs('#adminStatus').innerHTML = error
        ? `<div class="notice">${escapeHtml(error.message)}</div>`
        : `<div class="empty-state">Morceau supprimé. Recharge la page admin.</div>`;
    }

    const roleBtn = event.target.closest('.admin-user-role');
    if (roleBtn) {
      const { error } = await supabaseClient
        .from('profiles')
        .update({ is_admin: roleBtn.dataset.admin === 'true' })
        .eq('id', roleBtn.dataset.id);

      qs('#adminStatus').innerHTML = error
        ? `<div class="notice">${escapeHtml(error.message)}</div>`
        : `<div class="empty-state">Rôle utilisateur mis à jour. Recharge la page admin.</div>`;
    }

    const relDelete = event.target.closest('.admin-rel-delete');
    if (relDelete) {
      const { error } = await supabaseClient.from('song_relationships').delete().eq('id', relDelete.dataset.id);
      qs('#adminStatus').innerHTML = error
        ? `<div class="notice">${escapeHtml(error.message)}</div>`
        : `<div class="empty-state">Relation supprimée. Recharge la page admin.</div>`;
    }

    const approveBtn = event.target.closest('.admin-sub-approve');
    if (approveBtn) {
      await approveSubmission(approveBtn.dataset.id);
    }

    const rejectBtn = event.target.closest('.admin-sub-reject');
    if (rejectBtn) {
      const { error } = await supabaseClient
        .from('song_submissions')
        .update({ status: 'rejected' })
        .eq('id', rejectBtn.dataset.id);

      if (error) {
        qs('#adminStatus').innerHTML = `<div class="notice">${escapeHtml(error.message)}</div>`;
      } else {
        qs('#adminStatus').innerHTML = `<div class="empty-state">Proposition refusée.</div>`;
        window.location.reload();
      }
    }
  });
}

async function approveSubmission(submissionId) {
  const mount = qs('#adminStatus');
  const { data: submission, error: subError } = await supabaseClient
    .from('song_submissions')
    .select('*')
    .eq('id', submissionId)
    .maybeSingle();

  if (subError || !submission) {
    mount.innerHTML = `<div class="notice">Proposition introuvable.</div>`;
    return;
  }

  let artistId = submission.artist_id;
  if (!artistId && submission.artist_name_text) {
    const { data: existingArtist } = await supabaseClient
      .from('artists')
      .select('id')
      .ilike('name', submission.artist_name_text)
      .maybeSingle();

    if (existingArtist?.id) {
      artistId = existingArtist.id;
    } else {
      const { data: newArtist, error: newArtistError } = await supabaseClient
        .from('artists')
        .insert({ name: submission.artist_name_text })
        .select('id')
        .single();

      if (newArtistError) {
        mount.innerHTML = `<div class="notice">${escapeHtml(newArtistError.message)}</div>`;
        return;
      }
      artistId = newArtist.id;
    }
  }

  const { data: song, error: songError } = await supabaseClient
    .from('songs')
    .insert({
      title: submission.title,
      artist_id: artistId,
      release_year: submission.release_year,
      genre: submission.genre,
      description: submission.description,
      cover_url: submission.cover_url,
      spotify_url: submission.spotify_url || null,
      youtube_url: submission.youtube_url || null,
      apple_music_url: submission.apple_music_url || null,
      soundcloud_url: submission.soundcloud_url || null,
      preview_url: submission.preview_url || null,
      status: 'published',
      created_by: state.session.user.id
    })
    .select('id')
    .single();

  if (songError) {
    mount.innerHTML = `<div class="notice">${escapeHtml(songError.message)}</div>`;
    return;
  }

  if (submission.related_song_id && submission.relation_type) {
    await supabaseClient.from('song_relationships').insert({
      primary_song_id: song.id,
      related_song_id: submission.related_song_id,
      relation_type: submission.relation_type,
      created_by: state.session.user.id
    });
  }

  const { error: updateError } = await supabaseClient
    .from('song_submissions')
    .update({
      status: 'approved',
      approved_song_id: song.id,
      reviewed_by: state.session.user.id
    })
    .eq('id', submission.id);

  if (updateError) {
    mount.innerHTML = `<div class="notice">${escapeHtml(updateError.message)}</div>`;
  } else {
    mount.innerHTML = `<div class="empty-state">Proposition validée.</div>`;
    window.location.reload();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const page = document.body.dataset.page;
  if (page === 'home') await bootHome();
  if (page === 'song') await bootSongPage();
  if (page === 'login') await bootLoginPage();
  if (page === 'submit') await bootSubmitPage();
  if (page === 'favorites') await bootFavoritesPage();
  if (page === 'admin') await bootAdminPage();
});
