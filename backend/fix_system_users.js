#!/usr/bin/env node

/**
 * Script para corrigir e criar usuários de sistema necessários
 * 
 * Este script garante que os usuários de sistema (iframe, api key) existam
 * no banco de dados com os IDs corretos.
 */

require('dotenv').config()
const { supabaseAdmin } = require('./src/config/supabase')
const bcrypt = require('bcryptjs')

// Usuários de sistema que devem existir
const SYSTEM_USERS = [
  {
    id: 'aee9c880-9205-4c76-b260-062f6772af16',
    name: 'Iframe User',
    email: 'iframe@system.local',
    role: 'admin'
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'API Key User',
    email: 'apikey@system.local',
    role: 'admin'
  }
]

async function fixSystemUsers() {
  console.log('🔧 Iniciando correção de usuários de sistema...\n')

  const systemPassword = await bcrypt.hash('system-user-no-login', 12)

  for (const user of SYSTEM_USERS) {
    console.log(`Verificando usuário: ${user.name} (${user.email})`)

    // Verificar se usuário existe por ID
    const { data: existingById } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (existingById) {
      console.log(`  ✅ Usuário já existe com ID correto: ${user.id}`)
      continue
    }

    // Verificar se existe usuário com este email mas ID diferente
    const { data: existingByEmail } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', user.email)
      .maybeSingle()

    if (existingByEmail && existingByEmail.id !== user.id) {
      console.log(`  ⚠️ Encontrado usuário com email ${user.email} mas ID diferente: ${existingByEmail.id}`)
      console.log(`  🔄 Atualizando ID do usuário...`)

      // Atualizar o ID do usuário existente
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ id: user.id })
        .eq('id', existingByEmail.id)

      if (updateError) {
        console.log(`  ❌ Erro ao atualizar ID: ${updateError.message}`)
        console.log(`  🔄 Deletando usuário antigo e criando novo...`)

        // Se não conseguir atualizar, deletar e criar novo
        await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', existingByEmail.id)

        const { error: createError } = await supabaseAdmin
          .from('users')
          .insert({
            id: user.id,
            name: user.name,
            email: user.email,
            password: systemPassword,
            role: user.role,
            is_active: true
          })

        if (createError) {
          console.log(`  ❌ Erro ao criar usuário: ${createError.message}`)
        } else {
          console.log(`  ✅ Usuário recriado com sucesso!`)
        }
      } else {
        console.log(`  ✅ ID atualizado com sucesso!`)
      }
    } else {
      // Usuário não existe, criar
      console.log(`  🔨 Criando novo usuário...`)

      const { error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          id: user.id,
          name: user.name,
          email: user.email,
          password: systemPassword,
          role: user.role,
          is_active: true
        })

      if (createError) {
        console.log(`  ❌ Erro ao criar usuário: ${createError.message}`)
      } else {
        console.log(`  ✅ Usuário criado com sucesso!`)
      }
    }

    console.log('')
  }

  console.log('✅ Correção finalizada!\n')

  // Verificar todos os usuários
  console.log('📋 Listando todos os usuários de sistema:\n')

  for (const user of SYSTEM_USERS) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (data) {
      console.log(`✅ ${data.name}`)
      console.log(`   ID: ${data.id}`)
      console.log(`   Email: ${data.email}`)
      console.log(`   Role: ${data.role}`)
      console.log('')
    } else {
      console.log(`❌ ${user.name} - NÃO ENCONTRADO`)
      console.log('')
    }
  }
}

// Executar
fixSystemUsers()
  .then(() => {
    console.log('🎉 Script finalizado com sucesso!')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error)
    process.exit(1)
  })
