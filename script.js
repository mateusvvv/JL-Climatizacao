// Atualiza o ano no rodapé automaticamente
document.getElementById('current-year').textContent = new Date().getFullYear();

// Gerenciamento de Tema (Dark Mode)
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const htmlElement = document.documentElement;

// Verifica preferência salva ou do sistema
const applyTheme = () => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        htmlElement.classList.add('dark');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    } else {
        htmlElement.classList.remove('dark');
        themeIcon.classList.replace('fa-sun', 'fa-moon');
    }
};

applyTheme();

themeToggle.addEventListener('click', () => {
    htmlElement.classList.toggle('dark');
    if (htmlElement.classList.contains('dark')) {
        themeIcon.classList.replace('fa-moon', 'fa-sun');
        localStorage.theme = 'dark';
    } else {
        themeIcon.classList.replace('fa-sun', 'fa-moon');
        localStorage.theme = 'light';
    }
});

let coordsGlobal = null;

document.getElementById('btnLocalizacao').addEventListener('click', function() {
    const status = document.getElementById('statusLocalizacao');
    
    if (!navigator.geolocation) {
        status.textContent = "Geolocalização não é suportada pelo seu navegador.";
        status.classList.remove('hidden');
        return;
    }

    status.textContent = "Obtendo localização...";
    status.classList.remove('hidden', 'text-green-600', 'text-red-600');

    navigator.geolocation.getCurrentPosition((position) => {
        coordsGlobal = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        status.textContent = "✅ Localização GPS capturada!";
        status.classList.add('text-green-600');
    }, () => {
        status.textContent = "❌ Não foi possível obter sua localização. Por favor, digite o endereço.";
        status.classList.add('text-red-600');
    });
});

document.getElementById('osForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = "Processando...";

    // Captura os valores
    const nome = document.getElementById('nome').value;
    const telCliente = document.getElementById('whatsapp_cliente').value;
    const tipo = document.getElementById('tipoServico').value;
    const descricao = document.getElementById('descricao').value;

    // Número do Leandro (formato internacional sem o +)
    const telefoneLeandro = "558193833660";

    // Adiciona o link do mapa se a localização foi capturada
    let localLink = "";
    if (coordsGlobal) {
        localLink = `\n\n📍 *Localização GPS:* https://www.google.com/maps?q=${coordsGlobal.lat},${coordsGlobal.lng}`;
    }

    // Mensagem formatada
    const mensagemBase = `*NOVA ORDEM DE SERVIÇO - JL CLIMATIZAÇÃO*\n\n` +
                        `👤 *Cliente:* ${nome}\n` +
                        `📞 *WhatsApp:* ${telCliente}\n` +
                        `🛠️ *Tipo:* ${tipo}\n` +
                        `📝 *Detalhes:* ${descricao}${localLink}`;

    // Gerar link e redirecionar
    const url = `https://wa.me/${telefoneLeandro}?text=${encodeURIComponent(mensagemBase)}`;
    window.open(url, '_blank');

    setTimeout(() => {
        btn.disabled = false;
        btn.innerText = "Enviar Solicitação via WhatsApp";
    }, 2000);
});