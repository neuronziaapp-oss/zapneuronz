const ngrok = require('ngrok');

class NgrokService {
  constructor() {
    this.url = null;
    this.tunnel = null;
  }

  async startTunnel(port = 3001) {
    try {
      console.log('🚇 Iniciando túnel ngrok na porta', port, '...');
      
      // Verificar se já existe um túnel ativo
      if (this.url) {
        console.log('⚠️ Túnel ngrok já existe:', this.url);
        return this.url;
      }

      // Matar qualquer sessão ngrok anterior
      try {
        await ngrok.kill();
        console.log('🧹 Sessões ngrok anteriores encerradas');
      } catch (killError) {
        // Ignorar erro se não havia sessão ativa
      }

      // Configurar ngrok com authtoken se disponível
      const authToken = process.env.NGROK_AUTHTOKEN;
      if (authToken) {
        console.log('🔑 Configurando authtoken do ngrok...');
        await ngrok.authtoken(authToken);
      } else {
        console.log('⚠️ NGROK_AUTHTOKEN não configurado - usando túnel gratuito');
      }

      // Configurações do túnel
      const tunnelConfig = {
        port,
        proto: 'http',
        // Configurações para evitar tela de greetings
        bind_tls: true,
        inspect: false,
      };

      // Se há um domínio fixo configurado, usar ele
      const fixedDomain = process.env.NGROK_DOMAIN;
      if (fixedDomain) {
        tunnelConfig.hostname = fixedDomain;
        console.log('🏷️ Usando domínio fixo:', fixedDomain);
      }

      console.log('🔧 Configuração do túnel:', JSON.stringify(tunnelConfig, null, 2));

      // Criar túnel
      console.log('📡 Conectando ao ngrok...');
      this.url = await ngrok.connect(tunnelConfig);

      // Se usou domínio fixo, garantir que a URL está correta
      if (fixedDomain) {
        this.url = `https://${fixedDomain}`;
      }

      console.log('✅ Túnel ngrok criado com sucesso!');
      console.log('🌐 URL pública:', this.url);
      console.log('🔗 Webhook base:', `${this.url}/webhook`);
      
      return this.url;
    } catch (error) {
      console.error('❌ Erro ao criar túnel ngrok:', error.message);
      console.error('🔍 Detalhes do erro:', error);
      this.url = null;
      throw error;
    }
  }

  async stopTunnel() {
    try {
      if (this.url) {
        console.log('🛑 Fechando túnel ngrok...');
        await ngrok.kill();
        this.url = null;
        this.tunnel = null;
        console.log('✅ Túnel ngrok fechado');
      }
    } catch (error) {
      console.error('❌ Erro ao fechar túnel ngrok:', error.message);
    }
  }

  async checkTunnel() {
    if (!this.url) {
      console.log('🔍 Ngrok não está ativo (sem URL)');
      return false;
    }

    try {
      // Testar se o túnel ainda está funcionando
      const axios = require('axios');
      const testUrl = `${this.url}/health`;
      console.log('🔍 Testando túnel ngrok:', testUrl);
      
      const response = await axios.get(testUrl, { 
        timeout: 5000,
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      console.log('✅ Túnel ngrok ativo e funcionando');
      return true;
    } catch (error) {
      console.log('❌ Túnel ngrok offline:', error.message);
      this.url = null;
      return false;
    }
  }

  async restartTunnel(port = 3001) {
    console.log('🔄 Reiniciando túnel ngrok...');
    
    try {
      // Fechar túnel existente
      await this.stopTunnel();
      
      // Aguardar um pouco antes de reiniciar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Iniciar novo túnel
      return await this.startTunnel(port);
    } catch (error) {
      console.error('❌ Erro ao reiniciar túnel ngrok:', error.message);
      this.url = null;
      throw error;
    }
  }

  async checkTunnel() {
    if (!this.url) return false;
    
    try {
      // Testar se o túnel ainda está ativo fazendo uma requisição
      const axios = require('axios');
      await axios.get(`${this.url}/health`, { timeout: 5000 });
      return true;
    } catch (error) {
      console.log('⚠️ Túnel ngrok não responde, marcando como inativo');
      this.url = null;
      return false;
    }
  }

  getWebhookUrl() {
    return this.url ? `${this.url}/webhook` : null;
  }

  isActive() {
    return !!this.url;
  }
}

module.exports = new NgrokService();