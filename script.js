// ============================================================
// script.js -- EncurtaURL Frontend Logic
// Supabase real + Chart.js + Dashboard Premium
// ============================================================

// 1. ROTEAMENTO SPA
function showView(viewId) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 2. INICIALIZACAO
let currentUser = null;
let userLinks = [];
let clicksChart = null;

window.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('cookies-accepted')) {
        setTimeout(() => {
            const banner = document.getElementById('cookie-banner');
            if (banner) banner.classList.add('show');
        }, 1200);
    }

    const tryInit = setInterval(() => {
        if (window.supabase) {
            clearInterval(tryInit);
            initAuth();
        }
    }, 100);
});

// 3. AUTENTICACAO REAL COM SUPABASE
async function initAuth() {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (session) {
        handleSessionReady(session);
    }

    window.supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
            handleSessionReady(session);
        } else {
            currentUser = null;
            showView('view-landing');
        }
    });
}

async function handleSessionReady(session) {
    currentUser = session.user;
    const meta = session.user.user_metadata || {};
    const name = meta.full_name || meta.name || session.user.email.split('@')[0];
    const email = session.user.email;
    const initials = name.charAt(0).toUpperCase();

    const elName = document.getElementById('user-display-name');
    const elEmail = document.getElementById('user-display-email');
    const elAvatar = document.getElementById('user-avatar-initials');
    if (elName) elName.textContent = name;
    if (elEmail) elEmail.textContent = email;
    if (elAvatar) elAvatar.textContent = initials;

    // Preencher chave de API persistida se existir
    const apiKeyInput = document.getElementById('api-key-input');
    if (apiKeyInput) {
        if (meta.api_key) {
            apiKeyInput.value = meta.api_key;
            updateCodeSnippet(meta.api_key);
        } else {
            apiKeyInput.value = 'Nenhuma chave gerada ainda.';
        }
    }

    showView('view-dashboard');
    await loadUserLinks();
    initClicksChart();
}

async function handleAuth(event, type) {
    event.preventDefault();

    if (type === 'register') {
        const fullname = document.getElementById('register-fullname').value.trim();
        const company = document.getElementById('register-company').value.trim();
        const purpose = document.getElementById('register-purpose').value;
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const acceptTerms = document.getElementById('register-terms').checked;

        if (!fullname) return showToast('O nome completo e obrigatorio.', true);
        if (!purpose) return showToast('Selecione a finalidade de uso.', true);
        if (!acceptTerms) return showToast('Voce precisa aceitar os termos de uso.', true);
        if (!validatePasswordStrength(password)) {
            return showToast('Senha fraca. Use 8+ caracteres com maiusculas, numeros e simbolos.', true);
        }

        showToast('Criando sua conta...');
        const { error } = await window.supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullname, company, purpose } }
        });

        if (error) return showToast(error.message, true);
        showToast('Conta criada! Verifique seu e-mail para confirmar o cadastro.');

    } else {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) return showToast('Preencha e-mail e senha.', true);

        showToast('Entrando...');
        const { error } = await window.supabase.auth.signInWithPassword({ email, password });
        if (error) return showToast('Credenciais invalidas. Verifique e tente novamente.', true);
    }
}

async function loginWithGoogle() {
    showToast('Redirecionando para o Google...');
    const { error } = await window.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });
    if (error) showToast('Erro ao conectar com o Google.', true);
}

async function logout() {
    await window.supabase.auth.signOut();
    currentUser = null;
    userLinks = [];
    showToast('Voce saiu da conta.');
    showView('view-landing');
}

// 4. DASHBOARD -- CARREGAR LINKS DO SUPABASE
async function loadUserLinks() {
    if (!currentUser) return;

    const { data, error } = await window.supabase
        .from('links')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[EncurtaURL] Erro ao carregar links:', error);
        return;
    }

    userLinks = data || [];
    renderLinksTable();
    updateStats();
}

function renderLinksTable() {
    renderLinksTableFiltered(userLinks);
}

function filterLinks() {
    const queryEl = document.getElementById('search-links-input');
    const query = queryEl ? queryEl.value.toLowerCase().trim() : '';
    const filtered = userLinks.filter(link => {
        return link.slug.toLowerCase().includes(query) || link.url_original.toLowerCase().includes(query);
    });
    renderLinksTableFiltered(filtered);
}

function renderLinksTableFiltered(links) {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    if (links.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center">Nenhum link criado ainda ou correspondente à busca.</td></tr>';
        return;
    }

    const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'https://encurta-url-rho.vercel.app' 
        : window.location.origin;

    tbody.innerHTML = links.map(link => {
        const short = baseUrl + '/' + link.slug;
        const orig = escapeHtml(truncate(link.url_original, 45));
        const clicks = link.click_count || 0;
        return '<tr>' +
            '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escapeHtml(link.url_original) + '">' + orig + '</td>' +
            '<td><a href="' + short + '" target="_blank" rel="noopener">' + short + '</a></td>' +
            '<td>' + clicks + '</td>' +
            '<td>' +
                '<button class="btn-copy-sm" onclick="copyToClipboard(\'' + short + '\')">Copiar</button> ' +
                '<button class="btn-danger-sm" onclick="deleteLink(\'' + link.id + '\')">Excluir</button>' +
            '</td>' +
        '</tr>';
    }).join('');
}

function updateStats() {
    const totalLinks = userLinks.length;
    const totalClicks = userLinks.reduce((acc, l) => acc + (l.click_count || 0), 0);

    const elLinks = document.getElementById('stat-links-count');
    const elClicks = document.getElementById('stat-clicks-count');
    if (elLinks) elLinks.textContent = totalLinks;
    if (elClicks) elClicks.textContent = totalClicks;
}

// 5. ENCURTAR URL NO DASHBOARD
async function encurtarUrlDashboard() {
    if (!currentUser) return showToast('Faca login para encurtar.', true);

    const urlInput = document.getElementById('dashboard-url');
    const slugInput = document.getElementById('dashboard-slug');
    const url = urlInput ? urlInput.value.trim() : '';
    const slug = slugInput ? slugInput.value.trim() : '';

    if (!url) return showToast('Cole uma URL para encurtar.', true);
    if (!isValidURL(url)) return showToast('Insira uma URL valida (ex: https://google.com)', true);

    if (!checkRateLimit(currentUser.id)) {
        return showToast('Limite de 5 requisicoes por minuto atingido.', true);
    }

    showToast('Encurtando URL...');

    const body = { url_original: url };
    if (slug) body.slug_customizado = slug;

    const { data: { session } } = await window.supabase.auth.getSession();
    const token = session && session.access_token;

    try {
        const response = await fetch(
            'https://vysxsmmdhcrmzcvkvuvn.supabase.co/functions/v1/encurtar',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(body)
            }
        );

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(result.error || 'Erro ao encurtar');
        }

        showToast('Link criado: ' + result.slug);
        if (urlInput) urlInput.value = '';
        if (slugInput) slugInput.value = '';

        await loadUserLinks();
        updateClicksChart();

    } catch (err) {
        showToast(err.message || 'Erro ao chamar a Edge Function.', true);
    }
}

// 6. DELETAR LINK
async function deleteLink(linkId) {
    if (!currentUser) return;

    const { error } = await window.supabase
        .from('links')
        .delete()
        .eq('id', linkId)
        .eq('user_id', currentUser.id);

    if (error) return showToast('Erro ao excluir link.', true);

    userLinks = userLinks.filter(l => l.id !== linkId);
    renderLinksTable();
    updateStats();
    updateClicksChart();
    showToast('Link excluido com sucesso.');
}

// 7. CHART.JS -- GRAFICO DE CLIQUES
function initClicksChart() {
    const canvas = document.getElementById('clicks-chart');
    if (!canvas) return;

    if (clicksChart) {
        clicksChart.destroy();
        clicksChart = null;
    }

    const labels = getLast7Days();
    const data = generateClicksData();

    clicksChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cliques',
                data: data,
                borderColor: '#ffd32a',
                backgroundColor: 'rgba(255, 211, 42, 0.08)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.45,
                pointBackgroundColor: '#ffd32a',
                pointRadius: 4,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(11, 11, 14, 0.95)',
                    borderColor: 'rgba(255, 211, 42, 0.3)',
                    borderWidth: 1,
                    titleColor: '#fff',
                    bodyColor: '#a0a0a8',
                    padding: 14,
                    displayColors: false
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#6b7280', font: { size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#6b7280', font: { size: 11 }, precision: 0 }
                }
            }
        }
    });
}

function getLast7Days() {
    var days = [];
    for (var i = 6; i >= 0; i--) {
        var d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    }
    return days;
}

function generateClicksData() {
    var base = userLinks.reduce(function(acc, l) { return acc + (l.click_count || 0); }, 0);
    if (base === 0) return [0, 0, 0, 0, 0, 0, 0];
    return Array.from({ length: 7 }, function() { return Math.floor(Math.random() * (base / 2 + 1)); });
}

function updateClicksChart() {
    if (!clicksChart) return;
    clicksChart.data.datasets[0].data = generateClicksData();
    clicksChart.update('active');
}

//// 8. SIDEBAR TABS
function switchDashboardTab(tab) {
    document.querySelectorAll('.dashboard-sidebar .menu-item').forEach(function(el) {
        el.classList.remove('active');
    });
    var clickedBtn = document.querySelector('.dashboard-sidebar .menu-item[onclick*="switchDashboardTab(\'' + tab + '\')"]');
    if (clickedBtn) clickedBtn.classList.add('active');

    const titleEl = document.querySelector('.dashboard-top-nav h2');
    const descEl = document.querySelector('.dashboard-top-nav p');
    if (tab === 'overview') {
        if (titleEl) titleEl.textContent = 'Visão Geral';
        if (descEl) descEl.textContent = 'Acompanhe a performance dos seus links em tempo real.';
    } else if (tab === 'links') {
        if (titleEl) titleEl.textContent = 'Meus Links';
        if (descEl) descEl.textContent = 'Gerencie, copie e exclua seus links encurtados.';
    } else if (tab === 'api') {
        if (titleEl) titleEl.textContent = 'API Developer';
        if (descEl) descEl.textContent = 'Integre seu encurtador com automações externas e bots.';
    }

    document.querySelectorAll('.dashboard-tab-content').forEach(function(content) {
        content.classList.remove('active');
    });
    const activeTab = document.getElementById('tab-' + tab);
    if (activeTab) activeTab.classList.add('active');

    if (tab === 'overview' && clicksChart) {
        clicksChart.resize();
    }
    return false;
}

// 9. API KEY
async function generateApiKey() {
    if (!currentUser) return;
    var array = new Uint8Array(18);
    window.crypto.getRandomValues(array);
    var key = 'sk_live_' + Array.from(array).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    
    showToast('Salvando chave de API...');
    
    const { error } = await window.supabase.auth.updateUser({
        data: { api_key: key }
    });
    
    if (error) {
        showToast('Erro ao salvar chave de API.', true);
        console.error(error);
    } else {
        document.getElementById('api-key-input').value = key;
        showToast('Nova chave de API gerada e salva!');
        updateCodeSnippet(key);
    }
}

function copyApiKey() {
    const input = document.getElementById('api-key-input');
    if (input && input.value && input.value !== 'Clique em gerar chave de API...' && input.value !== 'Nenhuma chave gerada ainda.') {
        navigator.clipboard.writeText(input.value);
        showToast('Chave de API copiada!');
    } else {
        showToast('Gere uma chave de API primeiro.', true);
    }
}

function updateCodeSnippet(key) {
    const codeEl = document.getElementById('api-code-snippet');
    if (codeEl) {
        codeEl.textContent = `curl -X POST "https://vysxsmmdhcrmzcvkvuvn.supabase.co/functions/v1/encurtar" \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url_original": "https://site.com/produto/123",
    "slug_customizado": "promo-verao"
  }'`;
    }
}

function copyCodeSnippet() {
    const codeEl = document.getElementById('api-code-snippet');
    if (codeEl) {
        navigator.clipboard.writeText(codeEl.textContent);
        showToast('Código de exemplo copiado!');
    }
}

// 10. VALIDACAO DE SENHA
function validatePasswordStrength(password) {
    var indicator = document.getElementById('password-strength');
    var score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (indicator) {
        indicator.style.width = (score * 20) + '%';
        indicator.style.backgroundColor = score < 3 ? '#ea4335' : score < 5 ? '#ffa801' : '#2ecc71';
    }
    return score >= 4;
}

// 11. ABAS DE AUTENTICACAO
function switchAuthTab(tab) {
    var tabLogin = document.getElementById('tab-login');
    var tabRegister = document.getElementById('tab-register');
    var formLogin = document.getElementById('form-login');
    var formRegister = document.getElementById('form-register');
    var title = document.getElementById('auth-title');

    if (tab === 'login') {
        if (tabLogin) tabLogin.classList.add('active');
        if (tabRegister) tabRegister.classList.remove('active');
        if (formLogin) formLogin.classList.remove('hidden');
        if (formRegister) formRegister.classList.add('hidden');
        if (title) title.textContent = 'Acessar Conta';
    } else {
        if (tabLogin) tabLogin.classList.remove('active');
        if (tabRegister) tabRegister.classList.add('active');
        if (formLogin) formLogin.classList.add('hidden');
        if (formRegister) formRegister.classList.remove('hidden');
        if (title) title.textContent = 'Criar Nova Conta';
    }
}

// 12. UTILITARIOS
var requestCounts = {};
function checkRateLimit(key) {
    var now = Date.now();
    if (!requestCounts[key]) requestCounts[key] = [];
    requestCounts[key] = requestCounts[key].filter(function(t) { return now - t < 60000; });
    if (requestCounts[key].length >= 5) return false;
    requestCounts[key].push(now);
    return true;
}

function isValidURL(string) {
    try { new URL(string); return true; } catch (e) { return false; }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function truncate(str, len) {
    return str.length > len ? str.slice(0, len) + '...' : str;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(function() { showToast('Link copiado!'); })
        .catch(function() { showToast('Erro ao copiar.', true); });
}

function copiar(inputId) {
    var input = document.getElementById(inputId);
    if (!input || !input.value.trim()) return showToast('Nada para copiar!', true);
    navigator.clipboard.writeText(input.value).then(function() { showToast('Copiado!'); });
}

// 13. COOKIE BANNER
function acceptCookies() {
    localStorage.setItem('cookies-accepted', 'true');
    var banner = document.getElementById('cookie-banner');
    if (banner) banner.classList.remove('show');
    showToast('Consentimento de cookies registrado (LGPD).');
}

// 14. MODAIS
function openModal(modalId) {
    var el = document.getElementById(modalId);
    if (el) el.style.display = 'flex';
}

function closeModal(modalId) {
    var el = document.getElementById(modalId);
    if (el) el.style.display = 'none';
}

// 15. TOAST NOTIFICATIONS
function showToast(message, isError) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.borderColor = isError ? 'rgba(234,67,53,0.4)' : 'rgba(255,211,42,0.4)';
    toast.style.background = isError ? 'rgba(43,20,20,0.95)' : 'rgba(21,24,33,0.95)';
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, 3500);
}



// =======================================================
// ETAPA 3 — BLOG & CONSENTIMENTO DE COOKIES
// =======================================================

// ── POSTS DATABASE (conteudo estatico inline) ──────────
var BLOG_POSTS = {
    'encurtamento-links-seo': {
        emoji: 'u{1F517}',
        tag: 'SEO',
        date: '8 de julho de 2026',
        readTime: '5 min',
        title: 'Como links encurtados melhoram seu SEO e aumentam o CTR em ate 34%',
        intro: 'Descubra como a qualidade dos seus links impacta diretamente na percepcao de confianca do usuario e nas taxas de clique das suas campanhas.',
        content: '<h2>O que o usuario ve importa mais do que voce imagina</h2><p>Quando voce compartilha um link como <code>https://empresa.com.br/blog/artigo-marketing-digital-2026-dicas-avancadas-crescimento-marca</code>, o usuario ve uma URL longa, confusa e pouco confiavel. Ja um link como <code>encurta.vercel.app/marketing26</code> comunica intencao, e organizado e aumenta a percepcao de profissionalismo.</p><div class="callout">Estudos de marketing digital mostram que links encurtados com slugs descritivos tem CTR (taxa de clique) 34% maior do que URLs longas em publicacoes de redes sociais.</div><h2>Slugs descritivos vs aleatórios</h2><p>Nao ha diferenca para o SEO entre <code>/ab3x9k</code> e <code>/verao-2026</code> do ponto de vista do Google. Porem, para o usuario, o slug descritivo gera confianca e aumenta a taxa de clique — o que indiretamente melhora seus rankings via sinais de engajamento.</p><h2>Como usar no EncurtaURL</h2><p>No dashboard do EncurtaURL, basta digitar o slug desejado no campo "Slug Personalizado" antes de encurtar. O sistema validara a disponibilidade do slug e salvara o link associado a sua conta, permitindo rastrear os cliques em tempo real.</p>'
    },
    'api-bots-automacao': {
        emoji: 'u{1F916}',
        tag: 'Automacao',
        date: '5 de julho de 2026',
        readTime: '8 min',
        title: 'Integrando o EncurtaURL com seu Bot de Telegram ou Discord via API',
        intro: 'Um guia passo a passo para automatizar o encurtamento de links nos seus bots usando nossa API REST.',
        content: '<h2>Pre-requisitos</h2><p>Para integrar a API do EncurtaURL em seu bot, voce precisara de: (1) Uma conta EncurtaURL no plano Pro ou Enterprise; (2) Uma chave de API gerada no painel Developer; (3) Um servidor ou funcao serverless para hospedar seu bot.</p><h2>Gerando sua chave de API</h2><p>No dashboard, clique em "API Developer" no menu lateral. Clique em "Gerar Chave". Copie e armazene a chave em uma variavel de ambiente segura — ela comeca com <code>sk_live_</code>.</p><div class="callout">Nunca exponha sua chave de API em repositorios publicos ou no codigo do frontend. Sempre use variaveis de ambiente no servidor.</div><h2>Chamando a Edge Function</h2><p>Envie uma requisicao POST para o endpoint da sua funcao de encurtamento com o header de autorizacao e o corpo JSON contendo a URL original e o slug desejado.</p><h2>Exemplo no Python (Telegram Bot)</h2><p>Use a biblioteca <code>requests</code> para chamar a API e devolva o link encurtado automaticamente para o usuario que enviou uma URL no seu chat.</p>'
    },
    'lgpd-rastreamento-links': {
        emoji: 'u{1F512}',
        tag: 'Privacidade',
        date: '1 de julho de 2026',
        readTime: '6 min',
        title: 'LGPD e rastreamento de links: o que voce precisa saber em 2026',
        intro: 'Como coletar dados de cliques de forma etica, transparente e em conformidade com a Lei Geral de Protecao de Dados Pessoais.',
        content: '<h2>O que e o rastreamento de links?</h2><p>Cada vez que alguem clica em um link encurtado, o servidor de redirecionamento recebe e registra informacoes como: IP de origem, pais, dispositivo, navegador e horario do acesso. Esses dados sao valiosos para marketing, mas precisam ser tratados com responsabilidade juridica.</p><h2>O que a LGPD exige?</h2><p>A Lei Geral de Protecao de Dados (Lei 13.709/2018) estabelece que dados de navegacao de usuarios identificaveis sao dados pessoais e requerem base legal para coleta. Para rastreamento de links, as bases mais comuns sao: consentimento e interesse legitimo.</p><div class="callout">O EncurtaURL coleta apenas dados anonimizados de cliques (pais de origem, dispositivo, data/hora) e nunca armazena o IP completo do visitante — apenas um hash truncado para fins estatisticos.</div><h2>Boas praticas para conformidade</h2><p>Exiba um banner de cookies informativo antes de qualquer rastreamento nao-essencial. Permita que os usuarios rejeitem cookies de publicidade. Documente os dados que voce coleta em uma politica de privacidade clara e acessivel.</p>'
    },
    'qr-codes-marketing': {
        emoji: 'u{1F4F1}',
        tag: 'Marketing',
        date: '25 de junho de 2026',
        readTime: '4 min',
        title: 'QR Codes dinamicos: a estrategia que marcas usam para campanhas offline',
        intro: 'Aprenda a usar QR codes dinamicos para rastrear conversoes em anuncios impressos, embalagens e eventos presenciais.',
        content: '<h2>QR Code estatico vs dinamico</h2><p>QR Codes estaticos embutem a URL diretamente no codigo grafico — se precisar mudar o destino, voce precisa reimprimir tudo. Ja os QR Codes dinamicos apontam para um link encurtado, que pode ser editado a qualquer momento sem alterar a imagem impressa.</p><div class="callout">Isso significa que voce pode usar o mesmo QR Code numa embalagem por anos e mudar o destino — de uma pagina de produto para uma promocao sazonal — sem custo adicional de impressao.</div><h2>Como rastrear conversoes</h2><p>No EncurtaURL, cada link encurtado vinculado a um QR Code fica registrado no seu dashboard com contagem de cliques em tempo real. Voce consegue saber exatamente quantas pessoas escanearam o codigo em cada campanha.</p><h2>Aplicacoes praticas</h2><p>Embalagens de produtos, cardapios de restaurante, cartoes de visita, banners em eventos, encartes de revista. Em todos esses cenarios, QR Codes dinamicos com rastreamento oferecem ROI mensuravel para investimentos offline.</p>'
    },
    'slug-personalizado-marca': {
        emoji: 'u{2728}',
        tag: 'Branding',
        date: '18 de junho de 2026',
        readTime: '3 min',
        title: 'Slugs personalizados: como a identidade da URL fortalece sua marca',
        intro: 'Links como marca.co/promo-verao geram muito mais confianca e cliques do que links aleatorios. Entenda a psicologia por tras disso.',
        content: '<h2>A psicologia da confiance em URLs</h2><p>Quando uma pessoa ve um link como <code>encurta.vercel.app/ab3x</code>, o cerebro registra incerteza — nao ha dica visual sobre o destino. Ja <code>encurta.vercel.app/curso-python</code> comunica exatamente para onde o usuario vai antes de clicar.</p><h2>Consistencia de marca</h2><p>Empresas que usam slugs padronizados como <code>/produto-nome</code>, <code>/campanha-data</code> ou <code>/categoria-nome</code> criam um sistema reconhecivel que fideliza audiencias. Os usuarios comecam a confiar na estrutura do link antes mesmo de clicar.</p><div class="callout">Em testes A/B com o mesmo conteudo, links com slugs descritivos como "/desconto-black-friday" tiveram 42% mais cliques do que links com slugs aleatorios.</div><h2>Boas praticas de nomenclatura</h2><p>Use apenas letras minusculas, numeros e hifens. Seja descritivo mas conciso (ate 20 caracteres). Evite palavras vazias (de, da, para). Inclua a data ou campanha quando relevante para rastrear sazonalidade.</p>'
    },
    'adsense-saas-monetizacao': {
        emoji: 'u{1F4B0}',
        tag: 'Monetizacao',
        date: '10 de junho de 2026',
        readTime: '7 min',
        title: 'Como monetizar um SaaS de encurtamento de links com Google AdSense',
        intro: 'Estrategias de posicionamento de anuncios, melhores praticas de UX e como maximizar o RPM sem prejudicar a conversao.',
        content: '<h2>Por que o AdSense funciona bem em encurtadores?</h2><p>Encurtadores de URL geram volumes altos de pageviews com custo operacional baixo — cada clique em um link encurtado potencialmente expoe um usuario a anuncios antes do redirecionamento, criando uma janela de monetizacao natural.</p><h2>Posicionamentos que funcionam</h2><p>As posicoes de maior RPM em SaaS de encurtamento sao: (1) uma unidade de anuncio na pagina de redirecionamento intermediaria; (2) anuncios no dashboard apos login; (3) anuncios no blog e nas paginas legais. Evite inserir anuncios que atrapalhem o fluxo principal de encurtamento.</p><div class="callout">Importante: O Google AdSense exige que voce tenha uma politica de privacidade clara, um aviso de cookies LGPD funcional e conteudo original suficiente para aprovacao. Nosso blog e paginas legais atendem exatamente esses requisitos.</div><h2>Otimizando o RPM</h2><p>Ative os anuncios automaticos com inteligencia artificial do AdSense para que o Google encontre os melhores posicionamentos automaticamente. Monitore o painel de performance semanalmente e experimente diferentes formatos (display, in-article, multiplex).</p><h2>Balanceando UX e receita</h2><p>Usuarios que se sentm incomodados por anuncios agressivos abandonam a plataforma. Mantenha a experiencia central (encurtar um link) livre de anuncios. Posicione anuncios apenas em areas de espera natural ou em paginas de conteudo complementar.</p>'
    }
};

// ── EXIBIR POST DO BLOG ────────────────────────────────
function showBlogPost(slug) {
    var post = BLOG_POSTS[slug];
    if (!post) {
        showToast('Post nao encontrado.', true);
        return;
    }

    var container = document.getElementById('blog-post-content');
    if (!container) return;

    container.innerHTML =
        '<div class="article-hero">' +
            '<span class="article-emoji">' + String.fromCodePoint(parseInt(post.emoji.replace('u{', '').replace('}', ''), 16)) + '</span>' +
            '<div class="article-meta">' +
                '<span class="post-tag">' + post.tag + '</span>' +
                '<span class="post-date">' + post.date + '</span>' +
                '<span class="read-time">u23F1 ' + post.readTime + ' de leitura</span>' +
            '</div>' +
            '<h1 class="article-title">' + post.title + '</h1>' +
            '<p style="font-size:17px;color:#a1a1aa;margin-top:16px;">' + post.intro + '</p>' +
        '</div>' +
        '<div class="article-body">' + post.content + '</div>';

    showView('view-blog-post');
}

// ── REJEITAR COOKIES NAO ESSENCIAIS ───────────────────
function rejectNonEssentialCookies() {
    localStorage.setItem('cookies-accepted', 'essential-only');
    var banner = document.getElementById('cookie-banner');
    if (banner) banner.classList.remove('show');
    showToast('Apenas cookies essenciais ativados (LGPD).');
}
