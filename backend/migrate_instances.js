#!/usr/bin/env node

/**
 * Script para migrar instâncias entre usuários
 * Útil para consolidar instâncias antigas em novos clientes
 */

require('dotenv').config()
const { supabaseAdmin } = require('./src/config/supabase')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function listUsers() {
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  console.log('\n📋 USUÁRIOS DISPONÍVEIS:\n')
  users.forEach((user, index) => {
    console.log(`[${index + 1}] ${user.name}`)
    console.log(`    ID: ${user.id}`)
    console.log(`    Email: ${user.email}`)
    console.log(`    Client ID: ${user.client_id || 'N/A'}`)
    console.log('')
  })

  return users
}

async function listInstances(userId) {
  const { data: instances } = await supabaseAdmin
    .from('instances')
    .select('*')
    .eq('user_id', userId)

  return instances || []
}

async function migrateInstances() {
  console.log('🔄 MIGRAÇÃO DE INSTÂNCIAS ENTRE USUÁRIOS\n')
  console.log('='.repeat(60) + '\n')

  const users = await listUsers()

  // Selecionar usuário de origem
  const fromIndex = await question('Digite o número do usuário DE ORIGEM (quem TEM as instâncias): ')
  const fromUser = users[parseInt(fromIndex) - 1]

  if (!fromUser) {
    console.log('❌ Usuário inválido')
    rl.close()
    return
  }

  const instances = await listInstances(fromUser.id)

  if (instances.length === 0) {
    console.log(`\n⚠️  ${fromUser.name} não tem instâncias para migrar`)
    rl.close()
    return
  }

  console.log(`\n📱 Instâncias de ${fromUser.name}:\n`)
  instances.forEach((inst, index) => {
    console.log(`[${index + 1}] ${inst.name} (${inst.status})`)
  })

  // Selecionar usuário de destino
  console.log('\n')
  const toIndex = await question('Digite o número do usuário DE DESTINO (quem vai RECEBER): ')
  const toUser = users[parseInt(toIndex) - 1]

  if (!toUser) {
    console.log('❌ Usuário inválido')
    rl.close()
    return
  }

  if (fromUser.id === toUser.id) {
    console.log('❌ Usuário de origem e destino são o mesmo')
    rl.close()
    return
  }

  // Confirmar
  console.log(`\n⚠️  CONFIRMAÇÃO:`)
  console.log(`   DE: ${fromUser.name} (${fromUser.client_id || fromUser.email})`)
  console.log(`   PARA: ${toUser.name} (${toUser.client_id || toUser.email})`)
  console.log(`   ${instances.length} instância(s) será(ão) migrada(s)`)

  const confirm = await question('\nDigite "SIM" para confirmar: ')

  if (confirm.toUpperCase() !== 'SIM') {
    console.log('❌ Migração cancelada')
    rl.close()
    return
  }

  // Executar migração
  console.log('\n🔄 Migrando instâncias...\n')

  for (const instance of instances) {
    const { error } = await supabaseAdmin
      .from('instances')
      .update({ user_id: toUser.id })
      .eq('id', instance.id)

    if (error) {
      console.log(`❌ Erro ao migrar ${instance.name}:`, error.message)
    } else {
      console.log(`✅ ${instance.name} migrado com sucesso`)
    }
  }

  console.log('\n✅ Migração concluída!\n')

  // Mostrar resultado
  const newInstances = await listInstances(toUser.id)
  console.log(`${toUser.name} agora tem ${newInstances.length} instância(s)`)

  rl.close()
}

migrateInstances()
  .catch(error => {
    console.error('❌ Erro:', error)
    rl.close()
    process.exit(1)
  })
