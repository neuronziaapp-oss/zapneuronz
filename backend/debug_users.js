#!/usr/bin/env node

/**
 * Script para debug de multi-tenancy
 * Mostra todos os usuários e suas instâncias
 */

require('dotenv').config()
const { supabaseAdmin } = require('./src/config/supabase')

async function debugMultiTenancy() {
  console.log('🔍 DEBUG MULTI-TENANCY\n')
  console.log('=' .repeat(60))

  // 1. Listar todos os usuários
  console.log('\n📋 USUÁRIOS NO SISTEMA:\n')
  
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  if (usersError) {
    console.error('Erro ao buscar usuários:', usersError)
    return
  }

  for (const user of users) {
    console.log(`👤 ${user.name}`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Client ID: ${user.client_id || 'N/A'}`)
    console.log(`   Ativo: ${user.is_active ? 'Sim' : 'Não'}`)
    
    // Buscar instâncias deste usuário
    const { data: instances } = await supabaseAdmin
      .from('instances')
      .select('id, name, status, phone')
      .eq('user_id', user.id)

    console.log(`   📱 Instâncias: ${instances?.length || 0}`)
    if (instances && instances.length > 0) {
      instances.forEach(inst => {
        console.log(`      - ${inst.name} (${inst.status}) ${inst.phone || ''}`)
      })
    }
    console.log('')
  }

  console.log('=' .repeat(60))

  // 2. Verificar instâncias órfãs (sem user_id válido)
  console.log('\n⚠️  VERIFICANDO INSTÂNCIAS ÓRFÃS:\n')
  
  const { data: allInstances } = await supabaseAdmin
    .from('instances')
    .select('id, name, user_id')

  let orphanCount = 0
  for (const instance of allInstances || []) {
    const userExists = users.find(u => u.id === instance.user_id)
    if (!userExists) {
      orphanCount++
      console.log(`❌ Instância órfã: ${instance.name} (user_id: ${instance.user_id})`)
    }
  }

  if (orphanCount === 0) {
    console.log('✅ Nenhuma instância órfã encontrada')
  }

  console.log('\n' + '='.repeat(60))

  // 3. Estatísticas
  console.log('\n📊 ESTATÍSTICAS:\n')
  console.log(`Total de usuários: ${users.length}`)
  console.log(`Usuários com client_id: ${users.filter(u => u.client_id).length}`)
  console.log(`Usuários de sistema: ${users.filter(u => u.email.includes('@system.local') || u.email.includes('@iframe.local')).length}`)
  console.log(`Total de instâncias: ${allInstances?.length || 0}`)
  console.log(`Instâncias órfãs: ${orphanCount}`)

  console.log('\n' + '='.repeat(60) + '\n')
}

debugMultiTenancy()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erro:', error)
    process.exit(1)
  })
