@echo off
echo 🚀 Iniciando setup completo do WhatsApp Web...
echo.

:: Verificar se Node.js está instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js não está instalado. Por favor, instale Node.js 18+ primeiro.
    pause
    exit /b 1
)

echo ✅ Node.js encontrado:
node --version

:: Verificar se npm está instalado
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm não está instalado.
    pause
    exit /b 1
)

echo ✅ npm encontrado:
npm --version
echo.

:: Instalar dependências do projeto raiz
echo 📦 Instalando dependências do projeto raiz...
npm install
if errorlevel 1 goto error

:: Instalar dependências do backend
echo 📦 Instalando dependências do backend...
cd backend
npm install
if errorlevel 1 goto error
echo ✅ Dependências do backend instaladas

:: Executar setup do backend
echo ⚙️ Configurando backend...
node setup.js
if errorlevel 1 goto error

cd..

:: Verificar se frontend foi criado
if not exist "frontend" (
    echo 📱 Criando aplicação React para o frontend...
    npx create-react-app frontend
    if errorlevel 1 goto error
)

:: Instalar dependências adicionais do frontend
echo 📦 Instalando dependências adicionais do frontend...
cd frontend
npm install axios socket.io-client react-router-dom @heroicons/react react-toastify react-hot-toast tailwindcss @tailwindcss/forms @headlessui/react clsx
if errorlevel 1 goto error

echo ✅ Dependências do frontend instaladas
cd..

echo.
echo 🎉 Setup completo concluído!
echo.
echo 📋 Próximos passos:
echo 1. Configure o arquivo backend/.env com suas configurações
echo 2. Inicie a Evolution API (Docker recomendado)
echo 3. Execute 'npm run dev' para iniciar ambos os serviços
echo.
echo 📖 Para mais informações, consulte o README.md
echo.
pause
exit /b 0

:error
echo.
echo ❌ Erro durante o setup. Verifique os logs acima.
pause
exit /b 1
