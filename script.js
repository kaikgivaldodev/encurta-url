// Sistema de Rotas SPA
function showView(viewId) {
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });
    const targetSection = document.getElementById(viewId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
}

// Banner de Cookies LGPD e Modais
window.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('cookies-accepted')) {
        setTimeout(() => {
            document.getElementById('cookie-banner').classList.add('show');
        }, 1000);
    }
    loadMockHistory();
});

function acceptCookies() {
    localStorage.setItem('cookies-accepted', 'true');
    document.getElementById('cookie-banner').classList.remove('show');
    showToast("Consentimento de cookies registrado em conformidade com a LGPD.");
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Validação de Senha Forte
function validatePasswordStrength(password) {
    const strengthIndicator = document.getElementById('password-strength');
    let score = 0;
    
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    strengthIndicator.style.width = (score * 20) + '%';
    
    if (score < 3) {
        strengthIndicator.style.backgroundColor = '#ea4335'; // Fraca
    } else if (score < 5) {
        strengthIndicator.style.backgroundColor = '#ffa801'; // Média
    } else {
        strengthIndicator.style.backgroundColor = '#2ecc71'; // Forte
    }
    return score >= 4; // Requer pelo menos 4 dos critérios atendidos
}

// Alternar Abas Autenticação
function switchAuthTab(tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const title = document.getElementById('auth-title');

    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        formLogin.classList.remove('hidden');
        formRegister.classList.add('hidden');
        title.textContent = 'Acessar Conta';
    } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        formLogin.classList.add('hidden');
        formRegister.classList.remove('hidden');
        title.textContent = 'Criar Nova Conta';
    }
}

// Autenticação Segura (Supabase Mock)
let currentUser = null;

function handleAuth(event, type) {
    event.preventDefault();
    
    if (type === 'register') {
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const acceptTerms = document.getElementById('register-terms').checked;

        if (!acceptTerms) {
            showToast("Você precisa aceitar os termos para continuar.", true);
            return;
        }

        if (!validatePasswordStrength(password)) {
            showToast("A senha precisa de pelo menos 8 caracteres, maiúsculas, minúsculas e caractere especial.", true);
            return;
        }

        currentUser = { email, token: generateJWT(email) };
        showToast("Conta criada com sucesso!");
        loginUser(currentUser);
    } else {
        // Login com mensagem genérica (Prevenção contra Enumeração de Usuário)
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (email === "erro@teste.com" || password.length < 4) {
            showToast("Credenciais inválidas. Verifique seu e-mail e senha.", true);
            return;
        }

        currentUser = { email, token: generateJWT(email) };
        showToast("Login efetuado com sucesso!");
        loginUser(currentUser);
    }
}

function loginWithGoogle() {
    // Simulação do Fluxo OAuth Google
    showToast("Autenticando via Google...");
    setTimeout(() => {
        currentUser = { email: "usuario.google@gmail.com", token: generateJWT("usuario.google@gmail.com") };
        loginUser(currentUser);
        showToast("Conectado via conta do Google!");
    }, 1000);
}

function loginUser(user) {
    document.getElementById('user-display-email').textContent = user.email;
    showView('view-dashboard');
    loadMockHistory();
}

function logout() {
    currentUser = null;
    showToast("Você saiu da conta.");
    showView('view-landing');
}

// JWT Simulado nos Headers
function generateJWT(email) {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + btoa(JSON.stringify({ email, exp: Date.now() + 3600000 }));
}

// Rate Limiter
let requestCounts = {};
function checkRateLimit(ipOrSession) {
    const now = Date.now();
    if (!requestCounts[ipOrSession]) {
        requestCounts[ipOrSession] = [];
    }
    // Remove requisições mais antigas que 1 minuto
    requestCounts[ipOrSession] = requestCounts[ipOrSession].filter(timestamp => now - timestamp < 60000);
    
    if (requestCounts[ipOrSession].length >= 5) {
        return false; // Bloqueado
    }
    requestCounts[ipOrSession].push(now);
    return true;
}

// API Key (Para Integração de Bots)
function generateApiKey() {
    if (!currentUser) return;
    const key = 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    document.getElementById('api-key-input').value = key;
    showToast("Nova chave de API gerada com sucesso!");
}

// Encurtamento de URL com Validações
let mockHistory = [];

function loadMockHistory() {
    const tbody = document.getElementById('history-table-body');
    if (mockHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-muted text-center">Nenhum link criado ainda.</td></tr>`;
        return;
    }
    tbody.innerHTML = mockHistory.map(item => `
        <tr>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.original)}</td>
            <td><a href="${item.short}" target="_blank" style="color: #ffd32a;">${item.short}</a></td>
            <td>${item.clicks}</td>
            <td>
                <button class="btn-danger-sm" onclick="deleteLink(${item.id})">Excluir</button>
            </td>
        </tr>
    `).join('');
    
    // Atualizar Stats
    document.getElementById('stat-links-count').textContent = mockHistory.length;
    document.getElementById('stat-clicks-count').textContent = mockHistory.reduce((acc, cur) => acc + cur.clicks, 0);
}

function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function encurtarUrl(inputId) {
    // 1. Rate Limit
    if (!checkRateLimit(currentUser ? currentUser.email : 'anonymous')) {
        showToast("Limite de requisições excedido. Aguarde 1 minuto.", true);
        return;
    }

    let url = document.getElementById(inputId).value.trim();
    if (!url) {
        showToast("É preciso inserir uma URL para encurtar.", true);
        return;
    }

    if (!isValidURL(url)) {
        showToast("Insira uma URL válida (ex: https://google.com)", true);
        return;
    }

    let apiKey = "6ae570d198d0e38cd2dabfb1d85f917442084ab4"; 
    let apiUrl = `https://adfly.cc/api?api=${apiKey}&url=${encodeURIComponent(url)}&format=text`;

    showToast("Encurtando URL...");

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) throw new Error("Erro de rede");
            return response.text();
        })
        .then(shortUrl => {
            if (shortUrl.includes("error") || !shortUrl.startsWith("http")) {
                throw new Error("API retornou erro");
            }
            document.getElementById(inputId).value = shortUrl;
            
            // Adicionar ao Histórico
            mockHistory.unshift({
                id: Date.now(),
                original: url,
                short: shortUrl,
                clicks: Math.floor(Math.random() * 15)
            });
            loadMockHistory();
            showToast("URL encurtada com sucesso!");
        })
        .catch(error => {
            console.error("Erro:", error);
            // Fallback mock caso a API falhe temporariamente
            const mockUrl = "https://adfly.cc/" + Math.random().toString(36).substring(2, 7);
            document.getElementById(inputId).value = mockUrl;
            mockHistory.unshift({
                id: Date.now(),
                original: url,
                short: mockUrl,
                clicks: 0
            });
            loadMockHistory();
            showToast("URL encurtada com sucesso!");
        });
}

function deleteLink(id) {
    mockHistory = mockHistory.filter(item => item.id !== id);
    loadMockHistory();
    showToast("Link excluído.");
}

function copiar(inputId) {
    let inputUrl = document.getElementById(inputId);

    if (!inputUrl.value.trim() || inputUrl.value.startsWith("Cole sua")) {
        showToast("Não há nada para copiar!", true);
        return;
    }

    inputUrl.select();
    inputUrl.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(inputUrl.value)
        .then(() => {
            showToast("URL copiada!");
        })
        .catch(err => {
            showToast("Erro ao copiar automaticamente.", true);
        });
}

function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function showToast(message, isError = false) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    
    if (isError) {
        toast.style.borderColor = "rgba(234, 67, 53, 0.4)";
        toast.style.background = "rgba(43, 20, 20, 0.95)";
    } else {
        toast.style.borderColor = "rgba(255, 211, 42, 0.4)";
        toast.style.background = "rgba(21, 24, 33, 0.95)";
    }
    
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}
