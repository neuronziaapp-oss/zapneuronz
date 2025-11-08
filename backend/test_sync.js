// Teste para forçar uma sincronização manual

const axios = require('axios');

async function testSync() {
  try {
    const instanceId = process.argv[2]; // ID da instância como primeiro argumento
    const apiKey = process.argv[3]; // API key como segundo argumento
    
    if (!instanceId || !apiKey) {
      console.log('Uso: node test_sync.js [instanceId] [apiKey]');
      process.exit(1);
    }
    
    console.log(`Iniciando teste de sincronização para instância ${instanceId} com API key ${apiKey}`);
    
    const url = `http://localhost:3001/api/${instanceId}/chats/sync?api_key=${apiKey}`;
    
    console.log(`Enviando solicitação para: ${url}`);
    
    const response = await axios.post(url, {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Resposta do servidor:', response.data);
    console.log('Status da resposta:', response.status);
  } catch (error) {
    console.error('Erro ao testar sincronização:', error.message);
    if (error.response) {
      console.error('Dados da resposta de erro:', error.response.data);
      console.error('Status da resposta de erro:', error.response.status);
    }
  }
}

testSync();