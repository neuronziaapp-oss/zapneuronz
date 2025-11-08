@echo off
REM Script de setup para migração do Supabase no Windows
REM Execute este script após configurar suas variáveis de ambiente

echo 🚀 Iniciando setup do Supabase...

REM Verificar se as variáveis estão configuradas
if "%SUPABASE_URL%"=="" (
    echo ❌ Erro: Configure as variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY no .env
    echo.
    echo Exemplo:
    echo SUPABASE_URL=https://your-project.supabase.co
    echo SUPABASE_SERVICE_KEY=your-service-role-key
    echo.
    pause
    exit /b 1
)

if "%SUPABASE_SERVICE_KEY%"=="" (
    echo ❌ Erro: Configure as variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY no .env
    echo.
    echo Exemplo:
    echo SUPABASE_URL=https://your-project.supabase.co
    echo SUPABASE_SERVICE_KEY=your-service-role-key
    echo.
    pause
    exit /b 1
)

echo ✅ Variáveis de ambiente configuradas
echo 🔗 URL: %SUPABASE_URL%

REM Verificar se o schema foi executado
echo 📋 Próximos passos:
echo 1. Acesse seu dashboard do Supabase
echo 2. Vá no SQL Editor  
echo 3. Execute o arquivo: migrations\001_initial_schema.sql
echo.
echo 4. Configure sua API Key no .env:
echo    IFRAME_API_KEY=your-secure-api-key-for-iframe-access
echo.
echo 5. Execute: npm run dev

echo ✨ Setup concluído!
pause