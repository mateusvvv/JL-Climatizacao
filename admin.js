// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBuQu5IHt2CbAascfjdh-dfYptGU_MRxMA",
    authDomain: "jlclimatizacao-6d43d.firebaseapp.com",
    projectId: "jlclimatizacao-6d43d",
    storageBucket: "jlclimatizacao-6d43d.firebasestorage.app",
    messagingSenderId: "295085493454",
    appId: "1:295085493454:web:05fade19d788866e5ad49f",
    measurementId: "G-W1R8DQ8M1S"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- CONTROLE DE ACESSO ---
const loginForm = document.getElementById('loginForm');
const loginContainer = document.getElementById('login-container');
const adminContent = document.getElementById('admin-content');
const btnLogout = document.getElementById('btnLogout');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    auth.signInWithEmailAndPassword(email, password)
        .catch(error => alert("Erro ao entrar: " + error.message));
});

auth.onAuthStateChanged(user => {
    if (user) {
        loginContainer.classList.add('hidden');
        adminContent.classList.remove('hidden');
        initAdmin();
    } else {
        loginContainer.classList.remove('hidden');
        adminContent.classList.add('hidden');
    }
});

btnLogout.addEventListener('click', () => {
    auth.signOut();
});

// --- LÓGICA DO PAINEL ---
let editingDocId = null;

async function atualizarNumeroOS() {
    if (editingDocId) return; // Não altera o número se estiver editando

    // Busca a O.S. com o maior número gravado
    const querySnapshot = await db.collection('ordens').orderBy('numero', 'desc').limit(1).get();
    
    let proximo = 1;
    if (!querySnapshot.empty) {
        const ultimaOS = querySnapshot.docs[0].data();
        proximo = parseInt(ultimaOS.numero) + 1;
    }
    
    document.getElementById('numero-os-display').textContent = proximo;
}

async function initAdmin() {
    await atualizarNumeroOS();

    document.getElementById('pdf_data').valueAsDate = new Date();
    
    // Inicializa a renderização inicial
    renderHistorico();

    // Adiciona o ouvinte para a barra de pesquisa
    const inputBusca = document.getElementById('input-busca');
    if (inputBusca) {
        inputBusca.addEventListener('input', (e) => {
            renderHistorico(e.target.value.toLowerCase());
        });
    }
}

const listaMateriais = document.getElementById('lista-materiais');
const btnAddMaterial = document.getElementById('btn-add-material');
const inputMaoObra = document.getElementById('pdf_mao_obra');
const inputTotal = document.getElementById('pdf_total');

function calcularTotal() {
    let totalMat = 0;
    document.querySelectorAll('.material-row').forEach(row => {
        const q = parseFloat(row.querySelector('.mat-qtd').value) || 0;
        const v = parseFloat(row.querySelector('.mat-valor').value) || 0;
        totalMat += (q * v);
    });
    const mao = parseFloat(inputMaoObra.value) || 0;
    inputTotal.value = (totalMat + mao).toFixed(2);
}

btnAddMaterial.addEventListener('click', () => {
    const div = document.createElement('div');
    div.className = 'material-row flex flex-wrap md:flex-nowrap gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-200 animate-fade-in';
    div.innerHTML = `
        <input type="text" placeholder="Item" class="form-field !p-2 flex-grow mat-desc" required>
        <input type="number" placeholder="Qtd" class="form-field !p-2 w-16 mat-qtd" required min="1" value="1">
        <input type="number" step="0.01" placeholder="R$" class="form-field !p-2 w-24 mat-valor" required>
        <button type="button" class="text-red-500 p-2 remove-item"><i class="fas fa-trash"></i></button>
    `;
    div.querySelectorAll('input').forEach(i => i.addEventListener('input', calcularTotal));
    div.querySelector('.remove-item').addEventListener('click', () => { div.remove(); calcularTotal(); });
    listaMateriais.appendChild(div);
});

inputMaoObra.addEventListener('input', calcularTotal);

// --- FUNÇÃO REUTILIZÁVEL PARA GERAR PDF ---
async function gerarDocumentoPDF(dados, fotosSource = null) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // PDF Header
    doc.setFontSize(22).setTextColor(0, 31, 63).text("JL CLIMATIZAÇÃO", 105, 20, { align: 'center' });
    doc.setFontSize(10).setTextColor(100).text("Belo Jardim - PE | Tel: (81) 9383-3660", 105, 27, { align: 'center' });
    doc.setDrawColor(0, 31, 63).line(20, 35, 190, 35);

    doc.setFontSize(14).setTextColor(0).setFont(undefined, 'bold').text(`ORDEM DE SERVIÇO Nº ${dados.numero}`, 20, 45);
    doc.setFontSize(11).setFont(undefined, 'normal').text(`Data: ${dados.data}`, 160, 45);

    doc.autoTable({
        startY: 55, head: [['Informação', 'Detalhes']],
        body: [['Cliente', dados.cliente], ['Tipo', dados.tipo], ['Mão de Obra', `R$ ${parseFloat(dados.maoObra).toFixed(2)}`]],
        theme: 'striped', headStyles: { fillColor: [0, 31, 63] }
    });

    if (dados.materiais && dados.materiais.length > 0) {
        doc.text("Materiais:", 20, doc.lastAutoTable.finalY + 10);
        doc.autoTable({ 
            startY: doc.lastAutoTable.finalY + 15, 
            head: [['Item', 'Qtd', 'Unit.', 'Subtotal']], 
            body: dados.materiais, 
            theme: 'grid' 
        });
    }

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(16).setFont(undefined, 'bold').text(`TOTAL: R$ ${parseFloat(dados.total).toFixed(2)}`, 190, finalY, { align: 'right' });

    // Adicionar Fotos (Pode receber FileList ou Array de URLs)
    if (fotosSource && fotosSource.length > 0) {
        doc.addPage().text("Fotos do Serviço:", 20, 20);
        let y = 30;
        const xPos = [20, 110]; // Duas colunas
        
        for (let i = 0; i < fotosSource.length; i++) {
            const imgData = await new Promise(res => { 
                if (typeof fotosSource[i] === 'string') {
                    // Se for URL (Redownload)
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; canvas.getContext('2d').drawImage(img, 0, 0); res(canvas.toDataURL('image/jpeg')); };
                    img.src = fotosSource[i];
                } else {
                    // Se for arquivo (Novo upload)
                    const r = new FileReader(); 
                    r.onload = e => res(e.target.result); 
                    r.readAsDataURL(fotosSource[i]);
                }
            });
            
            const coluna = i % 2;
            doc.addImage(imgData, 'JPEG', xPos[coluna], y, 80, 60);
            
            if (coluna === 1 || i === fotosSource.length - 1) {
                y += 70; // Pula linha após a segunda foto
            }
            
            if (y > 240 && i < fotosSource.length - 1 && i % 2 === 1) {
                doc.addPage();
                y = 20;
            }
        }
    }

    doc.save(`OS_${dados.numero}_${dados.cliente.replace(/\s+/g, '_')}.pdf`);
}

async function renderHistorico(filtro = "") {
    const querySnapshot = await db.collection('ordens').orderBy('numero', 'desc').limit(50).get();
    const tbody = document.getElementById('corpo-historico');
    
    tbody.innerHTML = "";
    querySnapshot.forEach((doc) => {
        const os = doc.data();
        if (filtro === "" || os.cliente.toLowerCase().includes(filtro)) {
        tbody.innerHTML += `
        <tr class="border-b">
            <td class="p-4 font-bold text-blue-600">#${os.numero}</td>
            <td class="p-4">${os.data}</td>
            <td class="p-4 font-semibold">${os.cliente}</td>
            <td class="p-4">${os.tipo}</td>
            <td class="p-4 text-right font-bold">R$ ${os.total}</td>
            <td class="p-4 text-center flex justify-center gap-2">
                <button onclick="baixarNovamente('${doc.id}')" class="text-blue-500 hover:text-blue-700 p-2" title="Baixar PDF">
                    <i class="fas fa-download"></i>
                </button>
                <button onclick="editarOS('${doc.id}')" class="text-yellow-500 hover:text-yellow-700 p-2" title="Editar O.S.">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="excluirOS('${doc.id}')" class="text-red-500 hover:text-red-700 p-2" title="Excluir O.S.">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
        `;
        }
    });
}

window.baixarNovamente = async function(docId) {
    const doc = await db.collection('ordens').doc(docId).get();
    if (doc.exists) {
        const dados = doc.data();
        // Passa as URLs das fotos salvas no banco
        gerarDocumentoPDF(dados, dados.fotosUrls || []);
    }
};

window.editarOS = async function(docId) {
    const doc = await db.collection('ordens').doc(docId).get();
    if (doc.exists) {
        const os = doc.data();
        editingDocId = docId;
        
        // Preenche campos básicos
        document.getElementById('pdf_cliente').value = os.cliente;
        document.getElementById('pdf_tipo').value = os.tipo;
        const [d, m, y] = os.data.split('/');
        document.getElementById('pdf_data').value = `${y}-${m}-${d}`;
        document.getElementById('pdf_mao_obra').value = os.maoObra;
        document.getElementById('pdf_total').value = os.total;
        document.getElementById('numero-os-display').textContent = os.numero;

        // Limpa e reconstrói as linhas de materiais
        listaMateriais.innerHTML = '';
        os.materiais.forEach(m => {
            const div = document.createElement('div');
            div.className = 'material-row flex gap-2 items-center animate-fade-in';
            div.innerHTML = `
                <input type="text" value="${m[0]}" placeholder="Item" class="form-field !p-2 flex-grow mat-desc" required>
                <input type="number" value="${m[1]}" placeholder="Qtd" class="form-field !p-2 w-16 mat-qtd" required min="1">
                <input type="number" step="0.01" value="${m[2].replace('R$ ', '')}" placeholder="R$" class="form-field !p-2 w-24 mat-valor" required>
                <button type="button" class="text-red-500 p-2 remove-item"><i class="fas fa-trash"></i></button>
            `;
            div.querySelectorAll('input').forEach(i => i.addEventListener('input', calcularTotal));
            div.querySelector('.remove-item').addEventListener('click', () => { div.remove(); calcularTotal(); });
            listaMateriais.appendChild(div);
        });

        const btnSubmit = document.querySelector('#pdfForm button[type="submit"]');
        btnSubmit.innerHTML = '<i class="fas fa-save mr-2"></i> Atualizar O.S. (PDF)';
        btnSubmit.classList.replace('!bg-green-600', '!bg-yellow-600');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

window.excluirOS = async function(docId) {
    if (confirm("Tem certeza que deseja apagar esta O.S.? Isso removerá os dados e as fotos permanentemente.")) {
        try {
            const docRef = db.collection('ordens').doc(docId);
            const doc = await docRef.get();
            
            if (doc.exists) {
                const dados = doc.data();
                
                // Remove fotos do Storage se existirem para economizar espaço
                if (dados.fotosUrls && dados.fotosUrls.length > 0) {
                    for (const url of dados.fotosUrls) {
                        try {
                            await storage.refFromURL(url).delete();
                        } catch (err) {
                            console.warn("Arquivo de imagem não encontrado no Storage ou já removido.");
                        }
                    }
                }
                
                // Remove registro do Firestore
                await docRef.delete();
                await atualizarNumeroOS();
                renderHistorico();
            }
        } catch (error) {
            alert("Erro ao excluir: " + error.message);
        }
    }
};

document.getElementById('pdfForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerHTML;
    
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enviando para Nuvem...';

    const numeroOS = document.getElementById('numero-os-display').textContent;
    const cliente = document.getElementById('pdf_cliente').value;
    const tipo = document.getElementById('pdf_tipo').value;
    const data = document.getElementById('pdf_data').value.split('-').reverse().join('/');
    const maoObra = document.getElementById('pdf_mao_obra').value;
    const total = document.getElementById('pdf_total').value;
    const fotosInput = document.getElementById('pdf_fotos');

    const materiaisItens = [];
    document.querySelectorAll('.material-row').forEach(row => {
        const d = row.querySelector('.mat-desc').value;
        const q = row.querySelector('.mat-qtd').value;
        const v = row.querySelector('.mat-valor').value;
        materiaisItens.push([d, q, `R$ ${parseFloat(v).toFixed(2)}`, `R$ ${(q * v).toFixed(2)}`]);
    });

    // Upload das fotos para o Storage
    const fotosUrls = [];
    if (fotosInput.files.length > 0) {
        for (let i = 0; i < fotosInput.files.length; i++) {
            const file = fotosInput.files[i];
            const storageRef = storage.ref(`os_${numeroOS}/${Date.now()}_${file.name}`);
            await storageRef.put(file);
            const url = await storageRef.getDownloadURL();
            fotosUrls.push(url);
        }
    }

    let dadosOS = {
        numero: parseInt(numeroOS), // Salvamos como número para ordenação correta
        data: data,
        cliente: cliente,
        tipo: tipo,
        maoObra: maoObra,
        total: total,
        materiais: materiaisItens
    };

    if (editingDocId) {
        const doc = await db.collection('ordens').doc(editingDocId).get();
        const oldFotos = doc.data().fotosUrls || [];
        dadosOS.fotosUrls = [...oldFotos, ...fotosUrls];
        await db.collection('ordens').doc(editingDocId).update(dadosOS);
        alert("O.S. Atualizada!");
    } else {
        dadosOS.fotosUrls = fotosUrls;
        await db.collection('ordens').add(dadosOS);
        alert("O.S. Gerada!");
    }

    await gerarDocumentoPDF(dadosOS, fotosInput.files);
    
    alert("O.S. Gerada!");
    window.location.reload();
});