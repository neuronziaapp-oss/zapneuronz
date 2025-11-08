const fs = require('fs').promises
const path = require('path')
const { execSync } = require('child_process')

async function setup() {
  console.log('🚀 Iniciando setup do WhatsApp Web Backend...\n')

  try {
    // 1. Verificar se o arquivo .env existe
    const envPath = path.join(__dirname, '.env')

    try {
      await fs.access(envPath)
      console.log('✅ Arquivo .env encontrado')
    } catch (error) {
      console.log('📝 Criando arquivo .env...')
      const envExample = await fs.readFile(
        path.join(__dirname, '.env.example'),
        'utf8'
      )
      await fs.writeFile(envPath, envExample)
      console.log('✅ Arquivo .env criado com base no .env.example')
      console.log(
        '⚠️  IMPORTANTE: Edite o arquivo .env com suas configurações!'
      )
    }

    // 2. Criar diretório de uploads se não existir
    const uploadsPath = path.join(__dirname, 'uploads')
    try {
      await fs.access(uploadsPath)
      console.log('✅ Diretório uploads encontrado')
    } catch (error) {
      console.log('📁 Criando diretório uploads...')
      await fs.mkdir(uploadsPath, { recursive: true })
      console.log('✅ Diretório uploads criado')
    }

    // 3. Instalar dependências se necessário
    try {
      await fs.access(path.join(__dirname, 'node_modules'))
      console.log('✅ Dependências já instaladas')
    } catch (error) {
      console.log('📦 Instalando dependências...')
      execSync('npm install', { stdio: 'inherit' })
      console.log('✅ Dependências instaladas')
    }

    // 4. Mostrar próximos passos
    console.log('\n🎉 Setup concluído com sucesso!')
    console.log('\n📋 Próximos passos:')
    console.log('1. Edite o arquivo .env com suas configurações')
    console.log('   - Configure a URL e chave do Evolution API')
    console.log('   - Altere as credenciais do admin padrão')
    console.log('   - Configure JWT_SECRET para produção')
    console.log('')
    console.log('2. Inicie o servidor:')
    console.log('   npm run dev    (desenvolvimento)')
    console.log('   npm start      (produção)')
    console.log('')
    console.log('3. O servidor estará disponível em:')
    console.log('   http://localhost:3001')
    console.log('')
    console.log('4. Credenciais padrão do admin:')
    console.log('   Email: admin@wppweb.com')
    console.log('   Senha: admin123456')
    console.log('   ⚠️  ALTERE EM PRODUÇÃO!')
    console.log('')
    console.log('📖 Para mais informações, consulte o README.md')
  } catch (error) {
    console.error('❌ Erro durante setup:', error.message)
    process.exit(1)
  }
}

// Executar setup se chamado diretamente
if (require.main === module) {
  setup()
}

module.exports = setup
