(() => {
  const followedKey = 'profile_follows';
  const followCountsKey = 'profile_follow_counts';
  const reportsKey = 'feed_reports';
  const feedScopeKey = 'fortalfy_feed_scope';
  const partnerProductsKey = 'partner_food_products';
  const feedMediaDatabase = 'fortalfy-local-feed-media';
  const feedMediaStore = 'media';
  const nutritionFields = [
    ['energyKcal', 'Energia', 'kcal'],
    ['energyKj', 'Energia', 'kJ'],
    ['carbohydratesG', 'Carboidratos', 'g'],
    ['sugarsTotalG', 'Açúcares totais', 'g'],
    ['sugarsAddedG', 'Açúcares adicionados', 'g'],
    ['proteinG', 'Proteínas', 'g'],
    ['fatTotalG', 'Gorduras totais', 'g'],
    ['fatSaturatedG', 'Gorduras saturadas', 'g'],
    ['fatTransG', 'Gorduras trans', 'g'],
    ['fiberG', 'Fibra alimentar', 'g'],
    ['sodiumMg', 'Sódio', 'mg'],
    ['saltG', 'Sal', 'g']
  ];
  let detailProductId = '';
  let detailQuantity = 1;
  let nutritionView = 'portion';
  let feedMediaDatabasePromise;
  let feedObjectUrls = [];
  const originalOpenPublicProfile = window.openPublicProfile;
  const originalOpenModule = window.openModule;

  function readList(key) {
    return userStore(key, []);
  }

  function jsArg(value) {
    return escapeHtml(JSON.stringify(String(value)));
  }

  function openFeedMediaDatabase() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('Este navegador não oferece armazenamento local para vídeos do Feed.'));
    if (!feedMediaDatabasePromise) feedMediaDatabasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(feedMediaDatabase, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(feedMediaStore)) request.result.createObjectStore(feedMediaStore, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Não foi possível abrir o armazenamento local de mídia.'));
      request.onblocked = () => reject(new Error('Feche outras abas do Fortalfy para atualizar o armazenamento de mídia.'));
    });
    return feedMediaDatabasePromise;
  }

  async function saveFeedVideo(id, blob) {
    const db = await openFeedMediaDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(feedMediaStore, 'readwrite');
      tx.objectStore(feedMediaStore).put({ id, blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Não foi possível salvar o vídeo neste navegador.'));
      tx.onabort = () => reject(tx.error || new Error('O armazenamento local recusou o vídeo.'));
    });
  }

  async function getFeedVideo(id) {
    const db = await openFeedMediaDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(feedMediaStore, 'readonly').objectStore(feedMediaStore).get(id);
      request.onsuccess = () => resolve(request.result?.blob || null);
      request.onerror = () => reject(request.error || new Error('Não foi possível carregar o vídeo deste Feed.'));
    });
  }

  async function deleteFeedVideo(id) {
    const db = await openFeedMediaDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(feedMediaStore, 'readwrite');
      tx.objectStore(feedMediaStore).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Não foi possível remover o vídeo deste navegador.'));
    });
  }

  async function hydrateFeedVideos(root) {
    feedObjectUrls.forEach(url => URL.revokeObjectURL(url));
    feedObjectUrls = [];
    const videos = [...(root || document).querySelectorAll('video[data-feed-media-id]')];
    for (const video of videos) {
      try {
        const blob = await getFeedVideo(video.dataset.feedMediaId);
        if (!blob) throw new Error('O arquivo de vídeo não foi encontrado no armazenamento local.');
        const url = URL.createObjectURL(blob);
        feedObjectUrls.push(url);
        video.src = url;
      } catch (error) {
        console.error('Não foi possível carregar o vídeo da publicação.', error);
        video.insertAdjacentHTML('afterend', '<p class="feed-media-error">Não foi possível carregar este vídeo neste navegador.</p>');
      }
    }
  }

  function profileKey(id) {
    return `profile:${id}`;
  }

  function restaurantFollowKey(id) {
    return id.startsWith('partner:') ? profileKey(id.slice(8)) : `restaurant:${id}`;
  }

  function followList() {
    return readList(followedKey);
  }

  function following(id) {
    return followList().includes(id);
  }

  function followers(id) {
    return (userStore(followCountsKey, {})[id] || []).length;
  }

  function profilePhoto(email, fallback = '') {
    const record = userStore('demo_records', []).find(item => item.email === email);
    if (record?.profilePhoto) return record.profilePhoto;
    if (currentUser?.email === email && currentUser.profilePhoto) return currentUser.profilePhoto;
    const post = userStore('demo_professional_posts', []).find(item => item.email === email);
    return post?.authorPhoto || fallback || 'assets/fortalfy-alimentacao.svg';
  }

  function localCountLabel() {
    return 'neste navegador';
  }

  function setFollow(targetId) {
    if (!currentUser) {
      showToast('Entre na sua conta para seguir perfis.');
      return;
    }
    const email = currentUser.email;
    if (!targetId || targetId === profileKey(email)) {
      showToast('Não é possível seguir o próprio perfil.');
      return;
    }
    const follows = followList();
    const counts = userStore(followCountsKey, {});
    counts[targetId] = Array.isArray(counts[targetId]) ? counts[targetId] : [];
    if (follows.includes(targetId)) {
      saveUserStore(followedKey, follows.filter(id => id !== targetId));
      counts[targetId] = counts[targetId].filter(value => value !== email);
    } else {
      saveUserStore(followedKey, [...new Set([...follows, targetId])]);
      counts[targetId] = [...new Set([...counts[targetId], email])];
    }
    saveUserStore(followCountsKey, counts);
    if (document.getElementById('modal')?.classList.contains('show')) {
      if (targetId.startsWith('restaurant:')) openFoodRestaurantProfile(targetId.slice(11), detailProductId);
      else openCommunityProfile(targetId.slice(8));
    } else {
      const module = document.getElementById('moduleScreen')?.dataset.module;
      if (module === 'communityFeed' || module === 'professionalFeed') openModule(module);
    }
    showToast(following(targetId) ? 'Perfil seguido neste navegador.' : 'Você deixou de seguir este perfil.');
  }

  function followButton(id, label = 'Seguir') {
    const isFollowing = following(id);
    return `<button type="button" class="food-profile-action food-follow-button${isFollowing ? ' following' : ''}" onclick="setFortalfyFollow(${jsArg(id)})">${isFollowing ? '✓ Seguindo' : label}</button>`;
  }

  function countPosts(id) {
    return userStore('demo_professional_posts', []).filter(post => post.email === id || post.restaurantId === id).length;
  }

  function countNutrient(value, unit, usePer100, weightG) {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Não informado';
    const amount = usePer100 ? Number(value) * 100 / weightG : Number(value);
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(amount)} ${unit}`;
  }

  function selectedCustomizations(product) {
    const selected = [];
    (product.customizations || []).forEach((group, index) => {
      const name = `food-custom-${index}`;
      const elements = [...document.querySelectorAll(`[name="${name}"]:checked`)];
      elements.forEach(element => {
        const choice = (group.choices || []).find(item => item.id === element.value);
        if (choice) selected.push({ group: group.name, id: choice.id, name: choice.name, price: Number(choice.price) || 0 });
      });
      if (group.required && !elements.length) throw new Error(`Selecione uma opção em ${group.name}.`);
    });
    return selected;
  }

  function productStore(product) {
    return foodRestaurants.find(store => store.id === product.restaurantId) || null;
  }

  function partnerProductStoreId(email) {
    return `partner:${email}`;
  }

  function restorePartnerProducts() {
    const products = readList(partnerProductsKey);
    products.forEach(product => {
      if (!product || !product.id || !product.restaurantId || foodProducts.some(item => item.id === product.id)) return;
      foodProducts.push(product);
      if (!foodRestaurants.some(store => store.id === product.restaurantId)) {
        const record = userStore('demo_records', []).find(item => item.email === product.ownerEmail);
        foodRestaurants.push({
          id: product.restaurantId,
          name: record?.business || record?.name || product.restaurantName || 'Estabelecimento',
          image: product.restaurantImage || product.image || 'assets/food-bowl.jpg',
          description: 'Cardápio cadastrado pelo estabelecimento neste navegador.',
          categories: product.categories || ['saudavel']
        });
      }
    });
  }

  foodProducts.forEach(product => {
    Object.assign(product, {
      ingredients: product.ingredients ?? null,
      portion: product.portion ?? null,
      allergens: product.allergens ?? null,
      nutrition: product.nutrition ?? null,
      nutritionSource: product.nutritionSource ?? null,
      nutritionSourceDate: product.nutritionSourceDate ?? null,
      nutritionVerification: product.nutritionVerification ?? null,
      customizations: product.customizations ?? [],
      available: product.available ?? null,
      stock: product.stock ?? null
    });
  });
  restorePartnerProducts();

  window.setFortalfyFollow = setFollow;
  window.renderFoodProduct = function (product, index) {
    const unavailable = product.available === false || product.stock === 0;
    const storeName = productStore(product)?.name || product.restaurantName || '';
    const search = [product.name, product.description, product.search, storeName, ...(product.ingredients || [])].flat().join(' ');
    return `<article class="food-product-card" data-order="${index}" data-price="${product.price}" data-category="${escapeHtml((product.categories || []).join(' '))}" data-vegetarian="${(product.categories || []).includes('vegetariano')}" data-search="${escapeHtml(search)}" role="button" tabindex="0" aria-label="Ver detalhes de ${escapeHtml(product.name)}" onclick="if(!event.target.closest('button'))openFoodProduct(${jsArg(product.id)})" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openFoodProduct(${jsArg(product.id)})}">
      <img class="food-product-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">
      <div class="food-product-body"><span class="food-demo-label">${product.partnerProvided ? 'CADASTRADO PELO ESTABELECIMENTO' : 'CATÁLOGO ILUSTRATIVO'}</span>
      <h4><button class="food-product-title" type="button" onclick="event.stopPropagation();openFoodProduct(${jsArg(product.id)})">${escapeHtml(product.name)}</button></h4>
      <p>${escapeHtml(product.description)}</p><span class="food-product-price">${money(product.price)} <small>${product.partnerProvided ? 'preço informado pelo estabelecimento' : 'valor de referência'}</small></span>
      <button type="button" class="food-add-button" ${unavailable ? 'disabled' : ''} onclick="event.stopPropagation();addToCart(${jsArg(product.name)},${product.price},${jsArg(product.id)})">${unavailable ? 'Indisponível' : '<span aria-hidden="true">＋</span> Adicionar'}</button></div></article>`;
  };

  window.renderProfessionalFeed = function (onlyEmail = '') {
    seedDemoFeed();
    seedDemoAds();
    const posts = userStore('demo_professional_posts', []);
    const shares = userStore('demo_post_shares', []);
    const hiddenIds = userStore('hidden_feed_posts', []);
    const savedIds = userStore('saved_feed_posts', []);
    const expanded = [
      ...posts,
      ...shares.map(share => {
        const original = posts.find(post => post.id === share.postId);
        return original ? { ...original, id: share.id, sharedBy: share.sharedBy, sharedPostId: original.id, createdAt: share.createdAt } : null;
      }).filter(Boolean)
    ];
    const filtered = expanded.filter(post => {
      if (onlyEmail && post.email !== onlyEmail) return false;
      if (Boolean(hiddenIds.includes(post.id)) !== Boolean(window._fortalfyShowHiddenFeedPosts)) return false;
      if (window._fortalfyFeedScope === 'following') return following(post.restaurantId ? restaurantFollowKey(post.restaurantId) : profileKey(post.email));
      return true;
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const comments = userStore('demo_post_comments', {});
    const likes = userStore('demo_post_likes', {});
    const viewer = currentUser?.email || '';
    const identities = new Map();
    expanded.forEach(post => identities.set(post.email, post));
    foodRestaurants.forEach(store => identities.set(`food:${store.id}`, {
      email: `food:${store.id}`, name: store.name, roleLabel: 'Restaurante', photo: store.image, restaurantId: store.id
    }));
    const cards = filtered.map(post => {
      const postComments = comments[post.id] || [];
      const postLikes = likes[post.id] || [];
      const shareCount = shares.filter(share => share.postId === (post.sharedPostId || post.id)).length;
      const isOwn = viewer && post.email === viewer && !post.demo;
      const hasLiked = postLikes.includes(viewer);
      const identity = identities.get(post.email);
      const profileId = post.restaurantId ? restaurantFollowKey(post.restaurantId) : profileKey(post.email);
      const followerCount = followers(profileId);
      const label = escapeHtml(post.roleLabel || 'Comunidade Fortalfy');
      const longText = (post.text || '').length > 250;
      const commentItems = postComments.slice(-5).map(comment => {
        const commenterPhoto = profilePhoto(comment.email, comment.authorPhoto);
        const commentProfileLink = comment.email
          ? `onclick="openCommunityProfile(${jsArg(comment.email)})"`
          : '';
        return `<div class="comment-item">
          <button type="button" class="comment-avatar-link" ${commentProfileLink} aria-label="Abrir perfil de ${escapeHtml(comment.name || 'Usuário')}"><img src="${escapeHtml(comment.authorPhoto || commenterPhoto)}" alt=""></button>
          <div class="comment-body">${comment.replyToName ? `<small class="comment-reply-target">Respondendo a ${escapeHtml(comment.replyToName)}</small>` : ''}
            <div class="comment-bubble"><button type="button" class="comment-author-link" ${commentProfileLink}>${escapeHtml(comment.name || 'Usuário')}</button> ${escapeHtml(comment.text)} <small>${new Date(comment.createdAt).toLocaleDateString('pt-BR')}</small></div>
            <div class="comment-actions"><button type="button" onclick="replyFeedComment(${jsArg(post.id)},${jsArg(comment.createdAt)})">Responder</button>${comment.email === viewer ? `<button type="button" onclick="editFeedComment(${jsArg(post.id)},${jsArg(comment.createdAt)})">Editar</button><button type="button" onclick="deleteFeedComment(${jsArg(post.id)},${jsArg(comment.createdAt)})">Excluir</button>` : `<button type="button" onclick="reportFeedComment(${jsArg(post.id)},${jsArg(comment.createdAt)})">Denunciar</button>`}</div>
          </div>
        </div>`;
      }).join('');
      const media = post.mediaType === 'video'
        ? `<video class="post-video" ${post.mediaId ? `data-feed-media-id="${escapeHtml(post.mediaId)}"` : `src="${escapeHtml(post.photo)}"`} controls playsinline preload="metadata" aria-label="Vídeo publicado por ${escapeHtml(post.name)}"></video>`
        : post.photo ? `<img class="post-photo" alt="Imagem de ${escapeHtml(post.title || 'publicação')}" src="${escapeHtml(post.photo)}" loading="lazy">` : '';
      const saved = savedIds.includes(post.sharedPostId || post.id);
      return `<article class="social-post" data-feed-post="${escapeHtml(post.id)}">
        ${post.sharedBy ? `<p class="food-post-shared">↗ Compartilhado por ${escapeHtml(post.sharedBy.name)}</p>` : ''}
        <div class="social-post-head"><button class="profile-open" aria-label="Abrir perfil de ${escapeHtml(post.name)}" onclick="openCommunityProfile(${jsArg(post.email)})"><img class="avatar" src="${escapeHtml(post.authorPhoto || post.photo || 'assets/fortalfy-alimentacao.svg')}" alt=""></button>
        <div class="post-author"><button class="profile-open" onclick="openCommunityProfile(${jsArg(post.email)})"><b>${escapeHtml(post.name)}</b></button><small>${label} · ${new Date(post.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${post.editedAt ? ' · Editada' : ''}${post.demo ? ' · Conteúdo de referência' : ''}</small>
        ${!post.demo && window.isFortalfyVerifiedProfile?.(userStore('demo_records', []).find(record => record.email === post.email)) ? '<span class="verified">✓ Verificado</span>' : ''}
        <div class="post-author-social"><small>${followerCount} seguidores · neste dispositivo</small>${identity && post.email !== viewer ? `<button class="food-post-follow" type="button" onclick="setFortalfyFollow(${jsArg(profileId)})">${following(profileId) ? '✓ Seguindo' : 'Seguir'}</button>` : ''}</div></div>
        <details class="feed-post-menu"><summary aria-label="Opções da publicação">•••</summary><div>${isOwn ? `<button type="button" onclick="editFeedPost(${jsArg(post.id)})">Editar</button><button type="button" onclick="deleteFeedPost(${jsArg(post.id)})">Excluir</button>` : `<button type="button" onclick="reportFeedPost(${jsArg(post.id)})">Denunciar</button>`}<button type="button" onclick="toggleHiddenFeedPost(${jsArg(post.id)})">${hiddenIds.includes(post.id) ? 'Mostrar no Feed' : 'Ocultar do Feed'}</button></div></details></div>
        ${post.contentType ? `<span class="feed-content-type">${escapeHtml(post.contentType)}</span>` : ''}
        <h3>${escapeHtml(post.title || '')}</h3><p class="social-post-copy${longText ? ' is-collapsed' : ''}" ${longText ? 'data-collapsible="true"' : ''}>${escapeHtml(post.text || '')}</p>${longText ? `<button type="button" class="feed-expand-copy" onclick="toggleFeedPostText(this)">${'Ler mais'}</button>` : ''}
        ${media}
        ${post.ad ? '<p class="small">Conteúdo comercial de referência; não é campanha ativa.</p>' : ''}
        <div class="social-post-stats"><span>${postLikes.length} curtidas</span><span>${postComments.length} comentário(s)</span><span>${shareCount} compartilhamento(s)</span></div>
        <div class="social-actions"><button class="${hasLiked ? 'liked' : ''}" onclick="togglePostLike(${jsArg(post.id)})">${hasLiked ? '♥ Curtido' : '♡ Curtir'}</button><button onclick="focusPostComment(${jsArg(post.id)})">Comentar</button><button onclick="sharePostToFeed(${jsArg(post.sharedPostId || post.id)})">Compartilhar</button><button class="${saved ? 'saved' : ''}" onclick="toggleSavedFeedPost(${jsArg(post.sharedPostId || post.id)})" aria-label="${saved ? 'Remover publicação dos salvos' : 'Salvar publicação'}">${saved ? '▣ Salvo' : '▢ Salvar'}</button></div>
        <div class="comment-list">${commentItems}
        <form class="comment-form" onsubmit="addPostComment(event,${jsArg(post.id)})"><input id="comment-${escapeHtml(post.id)}" maxlength="300" required placeholder="Escreva um comentário…" aria-label="Escreva um comentário"><button type="submit">Enviar</button></form></div></article>`;
    }).join('');
    const scope = window._fortalfyFeedScope || 'all';
    const hiddenMode = Boolean(window._fortalfyShowHiddenFeedPosts);
    return `<div class="social-feed"><header class="social-topline"><div class="feed-wordmark"><span aria-hidden="true">F</span><div><h3>Fortalfy</h3><small>Comunidade em movimento</small></div></div><label class="feed-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Buscar publicações" aria-label="Buscar publicações" oninput="filterFeedSearch(this.value)"></label></header>
      <div class="food-feed-filter"><button class="${scope === 'all' ? 'active' : ''}" onclick="filterFeedScope('all')">Para você</button><button class="${scope === 'following' ? 'active' : ''}" onclick="filterFeedScope('following')">Seguindo</button><button onclick="openFollowedProfiles()">Perfis que sigo</button><button class="${hiddenMode ? 'active' : ''}" onclick="toggleHiddenFeedView()">${hiddenMode ? 'Voltar ao Feed' : 'Ocultos'}</button></div>
      ${currentUser ? `<form class="food-post-composer" onsubmit="publishUnifiedPost(event)"><button type="button" class="feed-composer-trigger" onclick="toggleFeedComposer(this)"><img src="${escapeHtml(currentUser.profilePhoto || 'assets/fortalfy-alimentacao.svg')}" alt="" class="feed-composer-avatar"><span>No que você está pensando?</span></button><div class="feed-composer-editor" hidden><div class="feed-composer-top"><div class="feed-composer-fields"><strong>Compartilhe com a comunidade</strong><input id="unifiedPostTitle" maxlength="90" required placeholder="Dê um título à sua publicação" aria-label="Título da publicação"><textarea id="unifiedPostText" maxlength="700" required placeholder="Escreva sua publicação" aria-label="Conteúdo da publicação"></textarea></div></div><div class="feed-composer-options"><label class="feed-composer-type">Tipo de conteúdo<select id="unifiedPostType"><option>Publicação</option><option>Treino</option><option>Refeição</option><option>Dica de bem-estar</option></select></label><label class="feed-media-picker">▧ Foto ou vídeo<input id="unifiedPostPhoto" type="file" accept="image/*,video/*" aria-label="Adicionar foto ou vídeo" onchange="previewUnifiedPostMedia(this)"></label><button class="btn" type="submit">Publicar</button><button class="feed-composer-cancel" type="button" onclick="toggleFeedComposer(this)">Fechar</button></div><div class="feed-media-preview" id="feedMediaPreview" hidden></div><label class="feed-post-consent"><input id="unifiedPostConsent" type="checkbox"> Confirmo que tenho autorização para publicar a mídia e não exponho dados pessoais sem consentimento.</label><p class="small">Esta publicação fica somente neste navegador até a integração com o serviço de Feed.</p></div></form>` : ''}
      ${cards || `<p class="muted">${hiddenMode ? 'Você ainda não ocultou publicações.' : scope === 'following' ? 'Ainda não há publicações de perfis que você segue. Siga profissionais ou restaurantes para acompanhar novidades.' : 'Ainda não há publicações neste Feed.'}</p>`}
      <p class="small">Curtidas, comentários, compartilhamentos e seguidores são armazenados somente neste navegador. Para torná-los compartilhados entre contas, é necessária a integração com o backend.</p></div>`;
  };

  window._fortalfyShowHiddenFeedPosts = false;
  window.filterFeedSearch = function (value) {
    const query = String(value || '').trim().toLocaleLowerCase('pt-BR');
    document.querySelectorAll('.social-post').forEach(post => {
      post.hidden = Boolean(query) && !post.textContent.toLocaleLowerCase('pt-BR').includes(query);
    });
  };
  window.toggleFeedPostText = function (button) {
    const copy = button?.previousElementSibling;
    if (!copy) return;
    const expanded = copy.classList.toggle('is-expanded');
    button.textContent = expanded ? 'Ler menos' : 'Ler mais';
  };
  window.toggleFeedComposer = function (button) {
    const form = button?.closest('.food-post-composer');
    if (!form) return;
    const trigger = form.querySelector('.feed-composer-trigger');
    const editor = form.querySelector('.feed-composer-editor');
    const opening = editor.hidden;
    editor.hidden = !opening;
    trigger.hidden = opening;
    if (opening) form.querySelector('#unifiedPostText')?.focus();
    else trigger.focus();
  };
  window.toggleSavedFeedPost = function (id) {
    if (!currentUser) return showToast('Entre na sua conta para salvar publicações.');
    const saved = userStore('saved_feed_posts', []);
    saveUserStore('saved_feed_posts', saved.includes(id) ? saved.filter(item => item !== id) : [...new Set([...saved, id])]);
    openModule(document.getElementById('moduleScreen')?.dataset.module || 'communityFeed');
    showToast(saved.includes(id) ? 'Publicação removida dos salvos neste navegador.' : 'Publicação salva neste navegador.');
  };
  window.toggleHiddenFeedPost = function (id) {
    const hidden = userStore('hidden_feed_posts', []);
    saveUserStore('hidden_feed_posts', hidden.includes(id) ? hidden.filter(item => item !== id) : [...new Set([...hidden, id])]);
    openModule(document.getElementById('moduleScreen')?.dataset.module || 'communityFeed');
    showToast(hidden.includes(id) ? 'Publicação restaurada neste navegador.' : 'Publicação ocultada neste navegador.');
  };
  window.toggleHiddenFeedView = function () {
    window._fortalfyShowHiddenFeedPosts = !window._fortalfyShowHiddenFeedPosts;
    openModule(document.getElementById('moduleScreen')?.dataset.module || 'communityFeed');
  };
  let feedPreviewUrl = '';
  window.previewUnifiedPostMedia = function (input) {
    const preview = document.getElementById('feedMediaPreview');
    if (!preview) return;
    if (feedPreviewUrl) URL.revokeObjectURL(feedPreviewUrl);
    feedPreviewUrl = '';
    preview.replaceChildren();
    const file = input.files?.[0];
    if (!file) {
      preview.hidden = true;
      return;
    }
    if (!(file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      input.value = '';
      preview.hidden = true;
      return showToast('Escolha uma imagem ou vídeo compatível.');
    }
    if (file.size > (file.type.startsWith('image/') ? 1.5 : 10) * 1024 * 1024) {
      input.value = '';
      preview.hidden = true;
      return showToast('A imagem deve ter até 1,5 MB e o vídeo até 10 MB.');
    }
    feedPreviewUrl = URL.createObjectURL(file);
    const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
    media.src = feedPreviewUrl;
    media.alt = file.type.startsWith('video/') ? 'Prévia do vídeo para a publicação' : 'Prévia da imagem para a publicação';
    if (media instanceof HTMLVideoElement) {
      media.controls = true;
      media.playsInline = true;
      media.preload = 'metadata';
    }
    preview.append(media);
    preview.hidden = false;
  };

  window.filterFeedScope = function (scope) {
    window._fortalfyFeedScope = scope === 'following' ? 'following' : 'all';
    try { localStorage.setItem(feedScopeKey, window._fortalfyFeedScope); } catch (error) { console.error('Não foi possível salvar a preferência do Feed.', error); }
    const module = document.getElementById('moduleScreen')?.dataset.module || 'communityFeed';
    openModule(module);
  };
  window._fortalfyFeedScope = localStorage.getItem(feedScopeKey) === 'following' ? 'following' : 'all';

  window.openCommunityProfile = function (id) {
    if (id.startsWith('food:')) return openFoodRestaurantProfile(id.slice(5));
    const profile = userStore('demo_records', []).find(record => record.email === id) ||
      (currentUser?.email === id ? currentUser : null);
    if (!profile) {
      if (typeof originalOpenPublicProfile === 'function') originalOpenPublicProfile(id);
      else showToast('Este perfil não está disponível.');
      const target = profileKey(id);
      addProfileActions(target, id, null);
      return;
    }
    const title = profile.business || profile.name || 'Perfil Fortalfy';
    const photo = profile.profilePhoto || 'assets/fortalfy-alimentacao.svg';
    const cover = profile.coverPhoto || 'assets/fortalfy-wallpaper.jpg';
    const verified = window.isFortalfyVerifiedProfile?.(profile) === true;
    const posts = userStore('demo_professional_posts', []).filter(post => post.email === id);
    document.getElementById('modalTitle').textContent = 'Perfil público';
    document.getElementById('modalContent').innerHTML = `<div class="food-public-profile"><img class="food-public-cover" src="${escapeHtml(cover)}" alt="Capa de ${escapeHtml(title)}"><div class="food-public-brand"><img src="${escapeHtml(photo)}" alt=""><div><h2>${escapeHtml(title)} ${verified ? '<span class="verified" title="Perfil aprovado pela Fortalfy">✓</span>' : ''}</h2><p class="muted">${escapeHtml(roleLabels[profile.role] || 'Comunidade Fortalfy')} · ${escapeHtml(profile.city || 'Localização não informada')}</p></div></div><p>${escapeHtml(profile.bio || 'Apresentação ainda não informada.')}</p><div class="food-public-stats"><span><strong>${posts.length}</strong> publicações</span><span><strong>${followers(profileKey(id))}</strong> seguidores (${localCountLabel()})</span><span>Avaliações: ainda sem dados</span></div><div class="food-profile-actions">${followButton(profileKey(id))}<button class="food-profile-action" onclick="openModule('professionalFeed')">Ver Feed</button></div><p class="small">O selo aparece somente quando a aprovação está registrada. Seguidores deste protótipo são locais e não representam uma contagem global.</p></div>`;
    document.getElementById('modal').classList.add('show');
  };

  window.adjustCartItem = function (index, change) {
    const item = cart[index];
    if (!item) return;
    const product = foodProducts.find(candidate => candidate.id === item.productId);
    if (change > 0 && product?.available === false) return showToast('Este produto está indisponível.');
    if (change > 0 && Number.isInteger(product?.stock) && item.quantity + change > product.stock) return showToast(`Estoque informado: ${product.stock} unidade(s).`);
    item.quantity += change;
    if (item.quantity <= 0) cart.splice(index, 1);
    if (!persistFoodCart()) return;
    updateFoodCartCount();
    openCart();
  };

  window.removeCartItem = function (index) {
    if (!Number.isInteger(index) || index < 0 || index >= cart.length) return;
    cart.splice(index, 1);
    if (!persistFoodCart()) return;
    updateFoodCartCount();
    openCart();
  };

  function addProfileActions(targetId, id, store) {
    const container = document.getElementById('modalContent');
    if (!container || container.querySelector('.food-profile-actions')) return;
    const profileInfo = container.querySelector('.profile-info') || container.firstElementChild;
    if (!profileInfo) return;
    const entries = userStore('demo_professional_posts', []).filter(post => post.email === id);
    profileInfo.insertAdjacentHTML('beforeend', `<div class="food-public-stats"><span><strong>${entries.length}</strong> publicações</span><span><strong>${followers(targetId)}</strong> seguidores (${localCountLabel()})</span><span>Avaliações: ainda sem dados</span></div><div class="food-profile-actions">${followButton(targetId)}<button class="food-profile-action" onclick="openModule('communityFeed')">Ver Feed</button></div><p class="small">Dados deste protótipo ficam apenas neste navegador. Selos dos perfis de referência não equivalem a uma aprovação comercial real.</p>`);
  }

  window.openFoodRestaurantProfile = function (id, fromProduct = '') {
    const store = foodRestaurants.find(item => item.id === id);
    if (!store) {
      showToast('O estabelecimento vinculado a este prato não foi encontrado.');
      return;
    }
    const restaurantProducts = foodProducts.filter(product => product.restaurantId === id);
    const profile = userStore('demo_records', []).find(record =>
      record.role === 'restaurante' && record.business && record.business === store.name);
    const verified = profile ? window.isFortalfyVerifiedProfile?.(profile) === true : false;
    const targetId = restaurantFollowKey(id);
    document.getElementById('modalTitle').textContent = store.name;
    document.getElementById('modalContent').innerHTML = `<div class="food-public-profile">
      <button class="food-detail-back" type="button" onclick="${fromProduct ? `openFoodProduct(${jsArg(fromProduct)})` : 'closeModal()'}">← Voltar</button>
      <img class="food-public-cover" src="${escapeHtml(store.image)}" alt="Imagem do estabelecimento ${escapeHtml(store.name)}">
      <div class="food-public-brand"><img src="${escapeHtml(store.image)}" alt=""><div><h2>${escapeHtml(store.name)} ${verified ? '<span class="verified" title="Verificação aprovada">✓</span>' : ''}</h2><p class="muted">Estabelecimento · ${escapeHtml(store.categories.join(', '))}</p></div></div>
      <p>${escapeHtml(store.description)}</p>
      <div class="food-public-stats"><span><strong>${countPosts(id)}</strong> publicações</span><span><strong>${followers(targetId)}</strong> seguidores (${localCountLabel()})</span><span>Avaliação: ainda sem avaliações</span></div>
      <div class="food-profile-actions">${followButton(targetId)}<button class="food-profile-action" onclick="closeModal();openFoodRestaurant(${jsArg(store.id)})">Ver cardápio</button></div>
      ${restaurantProducts.length ? `<section class="food-detail-section"><h3>Cardápio</h3>${restaurantProducts.map(product => `<button class="food-menu-item" type="button" onclick="openFoodProduct(${jsArg(product.id)})"><img src="${escapeHtml(product.image)}" alt=""><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.description)}</small><b>${money(product.price)}</b></span></button>`).join('')}</section>` : '<p class="muted">Este estabelecimento ainda não tem produtos cadastrados.</p>'}
      <p class="small">Não há dados de avaliação, recomendação, entrega ou verificação para este estabelecimento no catálogo local.</p></div>`;
    document.getElementById('modal').classList.add('show');
  };

  function nutritionValue(product, key, unit) {
    return countNutrient(product.nutrition?.[key], unit, nutritionView === '100g', Number(product.portion?.weightG));
  }

  function detailOptionMarkup(product) {
    return (product.customizations || []).map((group, index) => `<fieldset class="food-detail-section food-customization"><legend>${escapeHtml(group.name)}${group.required ? ' · obrigatório' : ' · opcional'}</legend>${(group.choices || []).map(choice => `<label><input type="${group.multiple ? 'checkbox' : 'radio'}" name="food-custom-${index}" value="${escapeHtml(choice.id)}" data-food-choice-price="${Number(choice.price) || 0}" onchange="refreshFoodDetailTotal()"> ${escapeHtml(choice.name)}${choice.price ? ` · +${money(choice.price)}` : ''}</label>`).join('')}</fieldset>`).join('');
  }

  window.openFoodProduct = function (id) {
    const product = foodProducts.find(item => item.id === id);
    if (!product) {
      showToast('Este produto não está mais disponível no catálogo.');
      return;
    }
    if (detailProductId !== id) {
      detailQuantity = 1;
      nutritionView = 'portion';
    }
    detailProductId = id;
    const store = productStore(product);
    const unavailable = product.available === false || product.stock === 0;
    const serving = product.portion?.label || (product.portion?.weightG ? `${product.portion.weightG} g` : 'Porção não informada');
    const facts = nutritionFields.map(([key, label, unit]) => `<tr><th scope="row">${label}</th><td>${nutritionValue(product, key, unit)}</td></tr>`).join('');
    const ingredients = Array.isArray(product.ingredients) ? product.ingredients : [];
    const allergens = Array.isArray(product.allergens) ? product.allergens : [];
    const restaurantTarget = store ? restaurantFollowKey(store.id) : '';
    document.getElementById('modalTitle').textContent = product.name;
    document.getElementById('modalContent').innerHTML = `<article class="food-detail">
      <button class="food-detail-back" type="button" onclick="closeModal()">← Voltar ao cardápio</button>
      <img class="food-detail-hero" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
      <header class="food-detail-heading"><span class="food-demo-label">${product.partnerProvided ? 'Informado pelo estabelecimento' : 'Item do catálogo ilustrativo'}</span><h2>${escapeHtml(product.name)}</h2><p class="food-detail-description">${escapeHtml(product.description)}</p><strong class="food-detail-price">${money(product.price)} <small>por unidade</small></strong></header>
      <section class="food-detail-section"><h3>Ingredientes e composição</h3>${ingredients.length ? `<ul class="food-detail-list">${ingredients.map(item => `<li>${escapeHtml(typeof item === 'string' ? item : `${item.name}${item.quantity ? ` — ${item.quantity}` : ''}`)}</li>`).join('')}</ul>` : '<p class="food-detail-disclosure">Ingredientes e quantidades não informados pelo estabelecimento.</p>'}<p class="food-detail-disclosure">Alergênicos e restrições: ${allergens.length ? escapeHtml(allergens.join(', ')) : 'não informados pelo estabelecimento.'}</p><p class="food-detail-disclosure">Porção: ${escapeHtml(serving)}. Disponibilidade: ${unavailable ? 'indisponível' : product.available === true ? 'informada pelo estabelecimento' : 'não confirmada em tempo real'}.</p></section>
      <section class="food-detail-section"><h3>Informações nutricionais</h3><div class="food-nutrition-tools"><label for="foodNutritionView">Exibir valores:</label><select id="foodNutritionView" onchange="setFoodNutritionView(this.value)"><option value="portion">Por ${escapeHtml(serving)}</option>${product.portion?.weightG ? '<option value="100g">Por 100 g · calculado proporcionalmente</option>' : ''}</select></div><table class="food-nutrition-table"><thead><tr><th>Informação</th><th>${nutritionView === '100g' ? 'Por 100 g' : `Por ${escapeHtml(serving)}`}</th></tr></thead><tbody>${facts}</tbody></table><p class="food-detail-disclosure">Fonte: ${escapeHtml(product.nutritionSource || 'não informada')}. ${product.nutritionSourceDate ? `Atualizada em ${escapeHtml(product.nutritionSourceDate)}.` : 'Data de atualização não informada.'} ${product.nutritionVerification === 'verified' ? 'Dados verificados pela Fortalfy.' : product.nutritionSource ? 'Informações fornecidas pelo estabelecimento; ainda não verificadas pela Fortalfy.' : 'Não há dados nutricionais cadastrados para este item.'}</p></section>
      ${product.customizations?.length ? `<section class="food-detail-section"><h3>Personalize seu prato</h3>${detailOptionMarkup(product)}<p class="food-detail-disclosure">A tabela nutricional corresponde à composição padrão; valores da combinação personalizada não foram calculados.</p></section>` : '<section class="food-detail-section"><h3>Personalização</h3><p class="food-detail-disclosure">Este produto não possui opções de personalização cadastradas.</p></section>'}
      ${store ? `<section class="food-detail-section"><h3>Estabelecimento</h3><div class="food-product-restaurant"><img src="${escapeHtml(store.image)}" alt=""><div><strong>${escapeHtml(store.name)}</strong><p>Nota, avaliações e entrega não informadas.</p><p>${followers(restaurantTarget)} seguidores neste navegador</p></div><button type="button" onclick="openFoodRestaurantProfile(${jsArg(store.id)},${jsArg(product.id)})">Ver restaurante</button></div></section>` : ''}
      <section class="food-detail-section"><div class="food-detail-quantity"><button type="button" aria-label="Diminuir quantidade" onclick="foodDetailChangeQuantity(-1)">−</button><strong id="foodDetailQuantity">1</strong><button type="button" aria-label="Aumentar quantidade" onclick="foodDetailChangeQuantity(1)">+</button><span id="foodDetailTotal">${money(product.price)}</span></div></section>
      <footer class="food-detail-bottom"><span id="foodDetailFooterTotal"><strong>${money(product.price)}</strong><small> total</small></span><button class="btn" type="button" ${unavailable ? 'disabled' : ''} onclick="addFoodDetailToCart()">${unavailable ? 'Produto indisponível' : 'Adicionar ao carrinho'}</button></footer>
      <p class="food-detail-disclosure">${product.partnerProvided ? 'Este cadastro foi informado pelo estabelecimento e ainda não é sincronizado com um servidor.' : 'Item ilustrativo: não há parceiro ativo, preço ou disponibilidade confirmados.'}</p>
    </article>`;
    document.getElementById('modal').classList.add('show');
  };

  window.setFoodNutritionView = function (view) {
    nutritionView = view === '100g' ? '100g' : 'portion';
    const product = foodProducts.find(item => item.id === detailProductId);
    if (product) openFoodProduct(product.id);
    const select = document.getElementById('foodNutritionView');
    if (select) select.value = nutritionView;
  };

  window.foodDetailChangeQuantity = function (change) {
    const product = foodProducts.find(item => item.id === detailProductId);
    if (!product) return;
    const max = Number.isInteger(product.stock) ? product.stock : Infinity;
    detailQuantity = Math.max(1, Math.min(max, detailQuantity + change));
    const customizationTotal = [...document.querySelectorAll('[data-food-choice-price]:checked')].reduce((sum, item) => sum + Number(item.dataset.foodChoicePrice || 0), 0);
    const total = (product.price + customizationTotal) * detailQuantity;
    const quantity = document.getElementById('foodDetailQuantity');
    const inline = document.getElementById('foodDetailTotal');
    const footer = document.getElementById('foodDetailFooterTotal');
    if (quantity) quantity.textContent = detailQuantity;
    if (inline) inline.textContent = money(total);
    if (footer) footer.innerHTML = `<strong>${money(total)}</strong><small> total</small>`;
  };

  window.refreshFoodDetailTotal = function () {
    const product = foodProducts.find(item => item.id === detailProductId);
    if (!product) return;
    const extra = [...document.querySelectorAll('[data-food-choice-price]:checked')].reduce((sum, item) => sum + Number(item.dataset.foodChoicePrice || 0), 0);
    const total = (product.price + extra) * detailQuantity;
    const inline = document.getElementById('foodDetailTotal');
    const footer = document.getElementById('foodDetailFooterTotal');
    if (inline) inline.textContent = money(total);
    if (footer) footer.innerHTML = `<strong>${money(total)}</strong><small> total</small>`;
  };

  window.addFoodDetailToCart = function () {
    const product = foodProducts.find(item => item.id === detailProductId);
    if (!product) return;
    if (product.available === false || product.stock === 0) {
      showToast('Este produto está indisponível.');
      return;
    }
    try {
      const options = selectedCustomizations(product);
      addConfiguredFoodItem(product, detailQuantity, options);
    } catch (error) {
      showToast(error.message);
    }
  };

  function addConfiguredFoodItem(product, quantity, options = []) {
    const extra = options.reduce((sum, option) => sum + option.price, 0);
    const unitPrice = product.price + extra;
    const optionKey = JSON.stringify(options.map(option => [option.id, option.price]).sort());
    const existing = cart.find(item => item.productId === product.id && (item.optionKey || '[]') === optionKey);
    const requested = (existing?.quantity || 0) + quantity;
    if (Number.isInteger(product.stock) && requested > product.stock) {
      showToast(`Estoque informado: ${product.stock} unidade(s).`);
      return;
    }
    if (existing) existing.quantity = requested;
    else cart.push({
      productId: product.id, name: product.name, image: product.image,
      price: unitPrice, basePrice: product.price, quantity,
      options, optionKey, restaurantId: product.restaurantId
    });
    if (!persistFoodCart()) return;
    updateFoodCartCount();
    showToast(`${product.name} adicionado ao carrinho.`);
  }

  window.addToCart = function (name, price, productId = '', quantity = 1, options = []) {
    if (!Number.isInteger(price) || price <= 0 || !Number.isInteger(quantity) || quantity < 1) {
      showToast('Não foi possível adicionar este item: preço ou quantidade inválidos.');
      return;
    }
    const product = foodProducts.find(item => item.id === productId);
    if (product && (product.available === false || product.stock === 0)) {
      showToast('Este produto está indisponível.');
      return;
    }
    if (product) return addConfiguredFoodItem(product, quantity, options);
    const matching = cart.find(item => !productId && item.name === name && item.price === price);
    if (matching) matching.quantity += quantity;
    else cart.push({ productId: productId || '', name, price, basePrice: price, quantity, options: [] });
    if (!persistFoodCart()) return;
    updateFoodCartCount();
    showToast(`${name} adicionado ao carrinho.`);
  };

  window.openCart = function () {
    const address = localStorage.getItem('fortalfy_food_address') || 'Endereço não definido';
    const subtotal = foodCartSubtotal();
    const quantity = foodCartQuantity();
    document.getElementById('modalTitle').textContent = 'Seu carrinho';
    document.getElementById('modalContent').innerHTML = `<div class="food-cart-modal">
      ${cart.length ? `<div class="food-cart-lines">${cart.map((item, index) => `<article class="food-cart-line"><img src="${escapeHtml(item.image || 'assets/food-bowl.jpg')}" alt="" width="54" height="54" style="object-fit:cover;border-radius:10px"><div><strong>${escapeHtml(item.name)}</strong><small>${money(item.price)} por unidade · ${item.productId && foodProducts.find(product => product.id === item.productId)?.partnerProvided ? 'preço informado pelo estabelecimento' : 'valor ilustrativo'}</small>${item.options?.length ? `<small>Adicionais: ${item.options.map(option => `${escapeHtml(option.name)}${option.price ? ` (+${money(option.price)})` : ''}`).join(', ')}</small>` : ''}</div><div class="food-quantity-control"><button type="button" aria-label="Diminuir quantidade de ${escapeHtml(item.name)}" onclick="adjustCartItem(${index},-1)">−</button><b>${item.quantity}</b><button type="button" aria-label="Aumentar quantidade de ${escapeHtml(item.name)}" onclick="adjustCartItem(${index},1)">+</button><button type="button" class="food-remove-item" onclick="removeCartItem(${index})">Remover</button></div><strong class="food-line-total">${money(item.price * item.quantity)}</strong></article>`).join('')}</div>` : '<div class="food-cart-empty"><strong>Seu carrinho está vazio</strong><p>Adicione um prato para ver seu resumo.</p></div>'}
      <div class="food-cart-address"><small>ENDEREÇO DE ENTREGA</small><strong>${escapeHtml(address)}</strong><button type="button" onclick="closeModal();openModule('restaurantMarketplace')">Alterar</button></div>
      <div class="food-cart-total"><span>Subtotal (${quantity} itens)</span><strong>${money(subtotal)}</strong><span>Entrega e taxas</span><strong>Não calculadas</strong><span>Descontos</span><strong>Não configurados</strong><span class="food-cart-subtotal-label">Total final</span><strong class="food-cart-subtotal">Indisponível sem cálculo de entrega</strong></div>
      <p class="food-detail-disclosure">Endereço e carrinho são locais. Preço e estoque precisam ser confirmados pelo servidor; entrega, descontos, pedidos e pagamento não estão conectados.</p>
      <div class="food-profile-actions"><button type="button" class="food-profile-action" onclick="closeModal()">Continuar comprando</button>${cart.length ? '<button class="btn" type="button" onclick="submitDemoOrder()">Salvar resumo local</button>' : ''}</div></div>`;
    document.getElementById('modal').classList.add('show');
  };

  window.submitDemoOrder = function () {
    if (!cart.length) {
      showToast('Adicione um produto antes de salvar o resumo.');
      return;
    }
    for (const item of cart) {
      const product = foodProducts.find(candidate => candidate.id === item.productId);
      if (!product) {
        showToast('Um produto do carrinho não está mais no catálogo. Revise os itens.');
        return;
      }
      if (product.price !== (item.basePrice ?? item.price)) {
        showToast('O preço cadastrado mudou. Confira o produto antes de continuar.');
        return;
      }
      if (product.available === false || (Number.isInteger(product.stock) && item.quantity > product.stock)) {
        showToast('A disponibilidade ou o estoque informado mudou. Revise a quantidade.');
        return;
      }
    }
    const summaries = userStore('food_demo_summaries', []);
    summaries.push({
      items: cart.map(item => ({ ...item, options: [...(item.options || [])] })),
      subtotal: foodCartSubtotal(), createdAt: new Date().toISOString(),
      status: 'resumo local — não é pedido'
    });
    try {
      saveUserStore('food_demo_summaries', summaries);
      cart = [];
      if (!persistFoodCart()) return;
      updateFoodCartCount();
      closeModal();
      showToast('Resumo salvo neste navegador; nenhum pedido foi enviado.');
    } catch (error) {
      console.error('Não foi possível salvar o resumo local do carrinho.', error);
      showToast('Não foi possível salvar o resumo neste navegador.');
    }
  };

  window.openFoodRestaurantProfile = function (id, fromProduct = '') {
    const store = foodRestaurants.find(item => item.id === id);
    if (!store) return showToast('Este estabelecimento não está disponível.');
    const products = foodProducts.filter(product => product.restaurantId === id);
    const targetId = restaurantFollowKey(id);
    const posts = userStore('demo_professional_posts', []).filter(post => post.restaurantId === id || post.email === `food:${id}`);
    const profile = userStore('demo_records', []).find(record => record.role === 'restaurante' && record.email === id.replace(/^partner:/, ''));
    const verified = profile ? window.isFortalfyVerifiedProfile?.(profile) === true : false;
    document.getElementById('modalTitle').textContent = store.name;
    document.getElementById('modalContent').innerHTML = `<div class="food-public-profile"><button class="food-detail-back" onclick="${fromProduct ? `openFoodProduct(${jsArg(fromProduct)})` : 'closeModal()'}">← Voltar</button><img class="food-public-cover" src="${escapeHtml(store.image)}" alt=""><div class="food-public-brand"><img src="${escapeHtml(store.image)}" alt=""><div><h2>${escapeHtml(store.name)} ${verified ? '<span class="verified" title="Verificação aprovada">✓</span>' : ''}</h2><p class="muted">Restaurante · ${escapeHtml(store.categories.join(', '))}</p></div></div><p>${escapeHtml(store.description)}</p><div class="food-public-stats"><span><strong>${posts.length}</strong> publicações</span><span><strong>${followers(targetId)}</strong> seguidores (${localCountLabel()})</span><span>Nota e recomendações: ainda sem avaliações</span></div><div class="food-profile-actions">${followButton(targetId)}<button class="food-profile-action" onclick="closeModal();openModule('restaurantMarketplace')">Ver cardápio</button></div>${products.length ? `<section class="food-detail-section"><h3>Cardápio</h3>${products.map(product => `<button class="food-menu-item" type="button" onclick="openFoodProduct(${jsArg(product.id)})"><img src="${escapeHtml(product.image)}" alt=""><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.description)}</small><b>${money(product.price)}</b></span></button>`).join('')}</section>` : '<p class="muted">Nenhum produto cadastrado.</p>'}<p class="small">Avaliações e métricas reais ainda não estão conectadas. Não há selo de verificação para este estabelecimento.</p></div>`;
    document.getElementById('modal').classList.add('show');
  };

  window.openFoodRestaurant = function (restaurantId) {
    const restaurant = foodRestaurants.find(store => store.id === restaurantId);
    if (!restaurant) return showToast('Este cardápio não está disponível no catálogo.');
    const products = foodProducts.filter(product => product.restaurantId === restaurantId);
    document.getElementById('modalTitle').textContent = restaurant.name;
    document.getElementById('modalContent').innerHTML = `<section class="food-menu-view"><button class="food-menu-back" type="button" onclick="closeModal()">← Voltar ao Fortalfy Food</button><img class="food-menu-hero" src="${escapeHtml(restaurant.image)}" alt="Imagem de referência do cardápio de ${escapeHtml(restaurant.name)}"><p class="food-menu-disclosure">Cardápio e preços de referência. Disponibilidade e entrega não foram conectadas.</p><div class="food-profile-actions"><button class="food-profile-action" type="button" onclick="openFoodRestaurantProfile(${jsArg(restaurant.id)})">Ver perfil do restaurante</button></div><h3>Cardápio</h3>${products.length ? products.map(product => `<article class="food-menu-item" role="button" tabindex="0" onclick="if(!event.target.closest('button'))openFoodProduct(${jsArg(product.id)})" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openFoodProduct(${jsArg(product.id)})}"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy"><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.description)}</small><b>${money(product.price)} · ${product.partnerProvided ? 'informado pelo estabelecimento' : 'valor de referência'}</b></span><button type="button" onclick="event.stopPropagation();addToCart(${jsArg(product.name)},${product.price},${jsArg(product.id)})">Adicionar</button></article>`).join('') : '<p class="food-empty-state">Este cardápio ainda não tem itens.</p>'}<p class="food-menu-disclosure">Ingredientes, tabela nutricional, alergênicos, preço e disponibilidade precisam ser fornecidos pelo responsável.</p></section>`;
    document.getElementById('modal').classList.add('show');
  };

  window.openPublicProfile = function (id) {
    if (!userStore('demo_records', []).some(profile => profile.email === id) && !['demo_marina', 'demo_rafael', 'demo_gym', 'demo_food', 'demo_brand'].includes(id)) {
      return openCommunityProfile(id);
    }
    originalOpenPublicProfile(id);
    addProfileActions(profileKey(id), id, null);
  };

  window.openFollowedProfiles = function () {
    const follows = followList();
    const posts = userStore('demo_professional_posts', []);
    const rows = follows.map(id => {
      if (id.startsWith('restaurant:')) {
        const store = foodRestaurants.find(item => item.id === id.slice(11));
        if (store) return { id, name: store.name, role: 'Restaurante', photo: store.image };
      }
      const email = id.slice(8);
      const record = userStore('demo_records', []).find(item => item.email === email);
      const post = posts.find(item => item.email === email);
      if (record || post) return { id, name: record?.business || record?.name || post?.name, role: roleLabels[record?.role] || post?.roleLabel || 'Perfil Fortalfy', photo: record?.profilePhoto || post?.photo || 'assets/food-bowl.jpg' };
      const demo = { demo_marina: 'Marina Costa', demo_rafael: 'Rafael Lima', demo_gym: 'Studio Viva', demo_food: 'NutriBem Kitchen' }[email];
      return demo ? { id, name: demo, role: 'Perfil de referência', photo: 'assets/food-bowl.jpg' } : null;
    }).filter(Boolean);
    document.getElementById('modalTitle').textContent = 'Perfis que sigo';
    document.getElementById('modalContent').innerHTML = `<div class="food-followed-list">${rows.length ? rows.map(row => `<div class="food-followed-row"><img src="${escapeHtml(row.photo)}" alt=""><span><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.role)}</small></span><button type="button" class="food-profile-action" onclick="${row.id.startsWith('restaurant:') ? `openFoodRestaurantProfile(${jsArg(row.id.slice(11))})` : `openCommunityProfile(${jsArg(row.id.slice(8))})`}">Abrir</button><button type="button" class="food-profile-action" onclick="setFortalfyFollow(${jsArg(row.id)})">Deixar de seguir</button></div>`).join('') : '<p class="muted">Você ainda não segue perfis.</p>'}<p class="small">Esta lista fica salva somente neste navegador.</p></div>`;
    document.getElementById('modal').classList.add('show');
  };

  window.togglePostLike = function (id) {
    if (!currentUser) return showToast('Entre na sua conta para curtir publicações.');
    const likes = userStore('demo_post_likes', {});
    likes[id] = Array.isArray(likes[id]) ? likes[id] : [];
    likes[id] = likes[id].includes(currentUser.email) ? likes[id].filter(email => email !== currentUser.email) : [...new Set([...likes[id], currentUser.email])];
    saveUserStore('demo_post_likes', likes);
    const module = document.getElementById('moduleScreen')?.dataset.module || 'communityFeed';
    openModule(module);
  };

  window.addPostComment = function (event, id) {
    event.preventDefault();
    if (!currentUser) return showToast('Entre na sua conta para comentar.');
    const input = document.getElementById(`comment-${id}`);
    const text = input?.value.trim();
    if (!text) return;
    const comments = userStore('demo_post_comments', {});
    comments[id] = [...(comments[id] || []), { name: currentUser.name || 'Usuário', email: currentUser.email, authorPhoto: currentUser.profilePhoto || '', text, createdAt: new Date().toISOString() }];
    saveUserStore('demo_post_comments', comments);
    const inputId = `comment-${id}`;
    openModule(document.getElementById('moduleScreen')?.dataset.module || 'communityFeed');
    document.getElementById(inputId)?.focus({ preventScroll: true });
    showToast('Comentário salvo neste navegador.');
  };

  window.deleteFeedComment = function (postId, createdAt) {
    const comments = userStore('demo_post_comments', {});
    comments[postId] = (comments[postId] || []).filter(comment => comment.createdAt !== createdAt || comment.email !== currentUser?.email);
    saveUserStore('demo_post_comments', comments);
    openModule(document.getElementById('moduleScreen')?.dataset.module || 'communityFeed');
    showToast('Comentário removido deste navegador.');
  };

  window.editFeedComment = function (postId, createdAt) {
    const comments = userStore('demo_post_comments', {});
    const comment = (comments[postId] || []).find(item => item.createdAt === createdAt && item.email === currentUser?.email);
    if (!comment) return showToast('Você só pode editar seus próprios comentários.');
    const text = prompt('Editar comentário', comment.text);
    if (text === null) return;
    if (!text.trim()) return showToast('O comentário não pode ficar vazio.');
    comment.text = text.trim().slice(0, 300);
    saveUserStore('demo_post_comments', comments);
    openModule(document.getElementById('moduleScreen')?.dataset.module || 'communityFeed');
    showToast('Comentário atualizado neste navegador.');
  };

  window.replyFeedComment = function (postId, parentCreatedAt) {
    if (!currentUser) return showToast('Entre na sua conta para responder.');
    const comments = userStore('demo_post_comments', {});
    const parent = (comments[postId] || []).find(comment => comment.createdAt === parentCreatedAt);
    if (!parent) return showToast('Este comentário não está mais disponível.');
    const text = prompt(`Responder a ${parent.name}`, '');
    if (text === null) return;
    if (!text.trim()) return showToast('A resposta não pode ficar vazia.');
    comments[postId] = [...(comments[postId] || []), {
      name: currentUser.name || 'Usuário',
      email: currentUser.email,
      authorPhoto: currentUser.profilePhoto || '',
      text: text.trim().slice(0, 300),
      replyTo: parentCreatedAt,
      replyToName: parent.name,
      createdAt: new Date().toISOString()
    }];
    saveUserStore('demo_post_comments', comments);
    openModule(document.getElementById('moduleScreen')?.dataset.module || 'communityFeed');
    showToast('Resposta salva neste navegador.');
  };

  window.publishUnifiedPost = function (event) {
    event.preventDefault();
    if (!currentUser) return showToast('Entre na sua conta para publicar.');
    const title = document.getElementById('unifiedPostTitle')?.value.trim();
    const text = document.getElementById('unifiedPostText')?.value.trim();
    const file = document.getElementById('unifiedPostPhoto')?.files[0];
    const type = document.getElementById('unifiedPostType')?.value || 'Publicação';
    if (!title || !text) return showToast('Informe o título e o conteúdo da publicação.');
    if (file && (!(file.type.startsWith('image/') || file.type.startsWith('video/')) || file.size > (file.type.startsWith('image/') ? 1.5 : 10) * 1024 * 1024)) return showToast('Escolha uma imagem de até 1,5 MB ou um vídeo de até 10 MB.');
    if (file && !document.getElementById('unifiedPostConsent')?.checked) return showToast('Confirme que tem autorização para publicar esta imagem.');
    const postId = `post-${crypto.randomUUID?.() || Date.now()}`;
    const save = (media, mediaId = '') => {
      const posts = userStore('demo_professional_posts', []);
      posts.push({ id: postId, email: currentUser.email, name: currentUser.business || currentUser.name, authorPhoto: currentUser.profilePhoto || '', roleLabel: roleLabels[currentUser.role] || 'Comunidade Fortalfy', title, text, contentType: type, photo: media || '', mediaId, mediaType: file?.type.startsWith('video/') ? 'video' : 'image', createdAt: new Date().toISOString(), demo: false });
      try {
        saveUserStore('demo_professional_posts', posts);
      } catch (error) {
        if (mediaId) deleteFeedVideo(mediaId).catch(storageError => console.error('Não foi possível remover um vídeo não vinculado após falha ao salvar a publicação.', storageError));
        console.error('Não foi possível salvar a publicação neste navegador.', error);
        return showToast('Não foi possível salvar a publicação. Verifique o espaço disponível neste navegador.');
      }
      if (feedPreviewUrl) URL.revokeObjectURL(feedPreviewUrl);
      feedPreviewUrl = '';
      openModule(document.getElementById('moduleScreen')?.dataset.module || 'communityFeed');
      showToast('Publicação adicionada ao Feed deste navegador.');
    };
    if (!file) return save('');
    if (file.type.startsWith('video/')) {
      saveFeedVideo(postId, file).then(() => save('', postId)).catch(error => {
        console.error('Não foi possível salvar o vídeo para a publicação.', error);
        showToast(`Não foi possível salvar o vídeo: ${error.message}`);
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => save(String(reader.result || ''));
    reader.onerror = () => showToast('Não foi possível carregar a imagem.');
    reader.readAsDataURL(file);
  };

  window.sharePostToFeed = function (id) {
    if (!currentUser) return showToast('Entre na sua conta para compartilhar.');
    const posts = userStore('demo_professional_posts', []);
    if (!posts.some(post => post.id === id)) return showToast('Esta publicação não está mais disponível.');
    const shares = userStore('demo_post_shares', []);
    if (shares.some(share => share.postId === id && share.sharedBy.email === currentUser.email)) return showToast('Você já compartilhou esta publicação no Feed.');
    shares.push({ id: `share-${crypto.randomUUID?.() || Date.now()}`, postId: id, sharedBy: { email: currentUser.email, name: currentUser.name }, createdAt: new Date().toISOString() });
    saveUserStore('demo_post_shares', shares);
    openModule(document.getElementById('moduleScreen')?.dataset.module || 'communityFeed');
    showToast('Publicação compartilhada no Feed deste navegador.');
  };

  window.editFeedPost = function (id) {
    const posts = userStore('demo_professional_posts', []);
    const post = posts.find(item => item.id === id && item.email === currentUser?.email && !item.demo);
    if (!post) return showToast('Você só pode editar suas próprias publicações.');
    const title = prompt('Editar título', post.title);
    if (title === null) return;
    const text = prompt('Editar conteúdo', post.text);
    if (text === null) return;
    if (!title.trim() || !text.trim()) return showToast('Título e conteúdo não podem ficar vazios.');
    post.title = title.trim().slice(0, 90);
    post.text = text.trim().slice(0, 700);
    post.editedAt = new Date().toISOString();
    saveUserStore('demo_professional_posts', posts);
    openModule(document.getElementById('moduleScreen')?.dataset.module || 'communityFeed');
    showToast('Publicação atualizada neste navegador.');
  };

  window.deleteFeedPost = function (id) {
    const posts = userStore('demo_professional_posts', []);
    const post = posts.find(item => item.id === id && item.email === currentUser?.email && !item.demo);
    if (!post) return showToast('Você só pode excluir suas próprias publicações.');
    if (!confirm('Excluir esta publicação deste navegador?')) return;
    saveUserStore('demo_professional_posts', posts.filter(post => post.id !== id));
    if (post.mediaId) deleteFeedVideo(post.mediaId).catch(error => {
      console.error('Não foi possível remover o vídeo associado à publicação.', error);
      showToast(`Publicação removida, mas não foi possível remover o vídeo: ${error.message}`);
    });
    openModule(document.getElementById('moduleScreen')?.dataset.module || 'communityFeed');
    showToast('Publicação removida deste navegador.');
  };

  function addLocalReport(kind, id, detailId = '') {
    if (!currentUser) return showToast('Entre na sua conta para denunciar conteúdo.');
    const reports = userStore(reportsKey, []);
    const exists = reports.some(report => report.kind === kind && report.contentId === id && report.detailId === detailId && report.reporter === currentUser.email);
    if (exists) return showToast('Você já enviou uma denúncia sobre este conteúdo neste navegador.');
    reports.push({ kind, contentId: id, detailId, reporter: currentUser.email, createdAt: new Date().toISOString() });
    saveUserStore(reportsKey, reports);
    showToast('Denúncia registrada somente neste navegador; a moderação não está conectada.');
  }

  window.reportFeedPost = id => addLocalReport('post', id);
  window.reportFeedComment = (postId, commentId) => addLocalReport('comment', postId, commentId);

  window.renderPartnerFoodConsole = function () {
    if (!currentUser || currentUser.role !== 'restaurante') return;
    const container = document.getElementById('modulePageContent');
    if (!container || container.querySelector('.food-partner-console')) return;
    const ownProducts = userStore(partnerProductsKey, []).filter(product => product.ownerEmail === currentUser.email);
    container.insertAdjacentHTML('afterbegin', `<section class="food-partner-console"><h3>Cardápio do estabelecimento</h3><p class="small">Cadastre e atualize itens locais para visualizar a estrutura do catálogo. Os dados não são enviados a um servidor nem ficam disponíveis para outros usuários.</p>
      <form onsubmit="saveFoodPartnerProduct(event)"><input id="partnerFoodProductId" type="hidden"><div class="food-partner-form-grid">
      <div class="field"><label for="partnerFoodName">Nome do prato *</label><input id="partnerFoodName" maxlength="100" required></div>
      <div class="field"><label for="partnerFoodPrice">Preço (R$) *</label><input id="partnerFoodPrice" type="number" min="0.01" step="0.01" required></div>
      <div class="field full"><label for="partnerFoodDescription">Descrição *</label><textarea id="partnerFoodDescription" maxlength="1000" required></textarea></div>
      <div class="field"><label for="partnerFoodPortion">Porção ou tamanho</label><input id="partnerFoodPortion" maxlength="60" placeholder="Ex.: embalagem individual"></div>
      <div class="field"><label for="partnerFoodWeight">Peso da porção (g)</label><input id="partnerFoodWeight" type="number" min="0" step="0.1"></div>
      <div class="field full"><label for="partnerFoodIngredients">Ingredientes e quantidades</label><textarea id="partnerFoodIngredients" maxlength="1500" placeholder="Um ingrediente por linha; inclua quantidades, se conhecidas"></textarea></div>
      <div class="field full"><label for="partnerFoodAllergens">Alergênicos informados</label><input id="partnerFoodAllergens" maxlength="500" placeholder="Somente informações confirmadas"></div>
      <div class="field full"><label>Dados nutricionais por porção (deixe em branco quando desconhecidos)</label><div class="food-partner-form-grid">${nutritionFields.map(([key, label, unit]) => `<div class="field"><label for="partner-${key}">${label} (${unit})</label><input id="partner-${key}" type="number" min="0" step="0.01"></div>`).join('')}</div></div>
      <div class="field full"><label for="partnerFoodNutritionSource">Fonte dos dados nutricionais</label><input id="partnerFoodNutritionSource" maxlength="200" placeholder="Ex.: ficha técnica do estabelecimento"></div>
      <div class="field"><label for="partnerFoodNutritionDate">Data da fonte</label><input id="partnerFoodNutritionDate" type="date"></div>
      <div class="field"><label for="partnerFoodStock">Estoque (unidades)</label><input id="partnerFoodStock" type="number" min="0" step="1" placeholder="Deixe vazio se não controlar"></div>
      <div class="field full"><label for="partnerFoodImage">Foto do prato (máx. 1,5 MB)</label><input id="partnerFoodImage" type="file" accept="image/*"></div>
      <label class="field"><span>Disponível segundo o estabelecimento</span><input id="partnerFoodAvailable" type="checkbox" checked></label></div>
      <p class="small">Nutrição será marcada como fornecida pelo estabelecimento, não verificada. Não há revisão documental, gerenciamento de equipe ou sincronização com clientes.</p><button class="btn" type="submit">Salvar item local</button></form>
      <h3>Itens cadastrados neste navegador</h3><div class="food-partner-products">${ownProducts.map(product => `<div class="food-partner-product-row"><span>${escapeHtml(product.name)} · ${money(product.price)} · ${product.available ? 'disponível' : 'indisponível'}</span><div><button type="button" class="food-profile-action" onclick="editFoodPartnerProduct(${jsArg(product.id)})">Editar</button><button type="button" class="food-profile-action" onclick="removeFoodPartnerProduct(${jsArg(product.id)})">Remover</button></div></div>`).join('') || '<p class="muted">Nenhum item cadastrado.</p>'}</div>
      <button class="food-profile-action" type="button" onclick="requestLocalVerification()">Solicitar análise de verificação</button><p class="small">A solicitação fica local e não aprova nem concede selo. A análise administrativa exige backend.</p></section>`);
  };

  window.saveFoodPartnerProduct = function (event) {
    event.preventDefault();
    if (!currentUser || currentUser.role !== 'restaurante') return showToast('Somente a conta de restaurante pode cadastrar itens.');
    const name = document.getElementById('partnerFoodName').value.trim();
    const description = document.getElementById('partnerFoodDescription').value.trim();
    const priceValue = Number(document.getElementById('partnerFoodPrice').value);
    const file = document.getElementById('partnerFoodImage').files[0];
    if (name.length < 2 || !description || !Number.isFinite(priceValue) || priceValue <= 0) return showToast('Informe nome, descrição e preço válidos.');
    if (file && (!file.type.startsWith('image/') || file.size > 1.5 * 1024 * 1024)) return showToast('A foto deve ser uma imagem de até 1,5 MB.');
    const nutrition = {};
    for (const [key, label] of nutritionFields) {
      const value = document.getElementById(`partner-${key}`).value;
      if (value === '') continue;
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) return showToast(`${label}: informe um valor não negativo ou deixe em branco.`);
      nutrition[key] = number;
    }
    const source = document.getElementById('partnerFoodNutritionSource').value.trim();
    if (Object.keys(nutrition).length && !source) return showToast('Informe a fonte dos dados nutricionais ou remova os valores.');
    const save = image => {
      const editingId = document.getElementById('partnerFoodProductId').value;
      const record = userStore('demo_records', []).find(item => item.email === currentUser.email);
      const storeId = partnerProductStoreId(currentUser.email);
      const stored = userStore(partnerProductsKey, []);
      const existing = editingId ? stored.find(item => item.id === editingId && item.ownerEmail === currentUser.email) : null;
      if (editingId && !existing) return showToast('Este item não pertence a esta conta ou não está disponível.');
      const weight = Number(document.getElementById('partnerFoodWeight').value);
      const stockInput = document.getElementById('partnerFoodStock').value;
      const ingredients = document.getElementById('partnerFoodIngredients').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      const product = {
        id: existing?.id || `partner-food-${crypto.randomUUID?.() || Date.now()}`, ownerEmail: currentUser.email,
        restaurantId: storeId, name, description, search: `${name} ${description} ${ingredients.join(' ')}`,
        price: Math.round(priceValue * 100), image: image || existing?.image || 'assets/food-bowl.jpg', categories: existing?.categories || ['saudavel'],
        ingredients: ingredients.length ? ingredients : null,
        portion: document.getElementById('partnerFoodPortion').value.trim() || (weight > 0 ? { weightG: weight } : null),
        allergens: document.getElementById('partnerFoodAllergens').value.split(',').map(value => value.trim()).filter(Boolean),
        nutrition: Object.keys(nutrition).length ? nutrition : null,
        nutritionSource: source || null,
        nutritionSourceDate: document.getElementById('partnerFoodNutritionDate').value || null,
        nutritionVerification: 'partner_provided',
        available: document.getElementById('partnerFoodAvailable').checked && !(stockInput !== '' && Number(stockInput) === 0),
        stock: stockInput === '' ? null : Number(stockInput),
        customizations: [], partnerProvided: true,
        restaurantName: record?.business || currentUser.business || currentUser.name,
        restaurantImage: currentUser.profilePhoto || 'assets/food-bowl.jpg'
      };
      if (typeof product.portion === 'string') product.portion = { label: product.portion, weightG: weight > 0 ? weight : null };
      try {
        saveUserStore(partnerProductsKey, existing ? stored.map(item => item.id === existing.id ? product : item) : [...stored, product]);
      } catch (error) {
        console.error('Não foi possível salvar o item do cardápio neste navegador.', error);
        showToast('Não foi possível salvar o item neste navegador.');
        return;
      }
      const productIndex = foodProducts.findIndex(item => item.id === product.id);
      if (productIndex < 0) foodProducts.push(product);
      else foodProducts[productIndex] = product;
      if (!foodRestaurants.some(store => store.id === storeId)) foodRestaurants.push({ id: storeId, name: product.restaurantName, image: product.restaurantImage, description: 'Cardápio cadastrado pelo estabelecimento neste navegador.', categories: ['saudavel'] });
      showToast(existing ? 'Item atualizado no catálogo local; não foi enviado ao backend.' : 'Item salvo no catálogo deste navegador. Ele ainda não foi enviado ao backend.');
      openModule('restaurantMarketplace');
    };
    if (!file) return save('');
    const reader = new FileReader();
    reader.onload = () => save(String(reader.result || ''));
    reader.onerror = () => showToast('Não foi possível carregar a foto.');
    reader.readAsDataURL(file);
  };

  window.editFoodPartnerProduct = function (id) {
    if (!currentUser || currentUser.role !== 'restaurante') return showToast('Ação restrita à conta do estabelecimento.');
    const product = userStore(partnerProductsKey, []).find(item => item.id === id && item.ownerEmail === currentUser.email);
    if (!product) return showToast('O item não pertence a esta conta.');
    const set = (selector, value) => { const field = document.getElementById(selector); if (field) field.value = value ?? ''; };
    set('partnerFoodProductId', product.id);
    set('partnerFoodName', product.name);
    set('partnerFoodPrice', (product.price / 100).toFixed(2));
    set('partnerFoodDescription', product.description);
    set('partnerFoodPortion', product.portion?.label || '');
    set('partnerFoodWeight', product.portion?.weightG || '');
    set('partnerFoodIngredients', (product.ingredients || []).join('\n'));
    set('partnerFoodAllergens', (product.allergens || []).join(', '));
    set('partnerFoodNutritionSource', product.nutritionSource || '');
    set('partnerFoodNutritionDate', product.nutritionSourceDate || '');
    set('partnerFoodStock', product.stock ?? '');
    const availability = document.getElementById('partnerFoodAvailable');
    if (availability) availability.checked = product.available !== false;
    nutritionFields.forEach(([key]) => set(`partner-${key}`, product.nutrition?.[key] ?? ''));
    document.getElementById('partnerFoodName')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('partnerFoodName')?.focus();
  };

  window.removeFoodPartnerProduct = function (id) {
    if (!currentUser || currentUser.role !== 'restaurante') return showToast('Ação restrita à conta do estabelecimento.');
    const stored = userStore(partnerProductsKey, []);
    const product = stored.find(item => item.id === id && item.ownerEmail === currentUser.email);
    if (!product) return showToast('O item não pertence a esta conta.');
    saveUserStore(partnerProductsKey, stored.filter(item => item.id !== id));
    const index = foodProducts.findIndex(item => item.id === id);
    if (index >= 0) foodProducts.splice(index, 1);
    showToast('Item removido do catálogo local.');
    openModule('partner');
  };

  window.requestLocalVerification = function () {
    if (!currentUser || !['restaurante', 'academia', 'personal', 'nutricionista'].includes(currentUser.role)) return showToast('Este tipo de perfil não pode solicitar verificação comercial.');
    const requests = userStore('local_verification_requests', []);
    if (requests.some(request => request.email === currentUser.email && request.status === 'pending')) return showToast('Já existe uma solicitação local pendente.');
    requests.push({ email: currentUser.email, status: 'pending', createdAt: new Date().toISOString() });
    saveUserStore('local_verification_requests', requests);
    showToast('Solicitação salva neste navegador; nenhum selo foi concedido.');
  };

  window.openModule = function (module) {
    originalOpenModule(module);
    if (['communityFeed', 'professionalFeed', 'professionals'].includes(module)) hydrateFeedVideos(document.getElementById('modulePageContent'));
    if (module === 'partner') window.renderPartnerFoodConsole();
    if (module === 'professionalFeed') document.querySelector('#modulePageContent form[onsubmit="publishProfessionalPost(event)"]')?.remove();
  };

  window.focusPostComment = function (id) {
    document.getElementById(`comment-${id}`)?.focus();
  };
})();
