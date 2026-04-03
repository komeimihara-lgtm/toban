import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const users = [
  { name: '三原 彩',       email: 'aya@lenard.jp',          role: 'director' },
  { name: '中村 和彦',     email: 'nakamura@lenard.jp',      role: 'leader' },
  { name: '五島 久美子',   email: 'goshima@lenard.jp',       role: 'leader' },
  { name: '吉田 浩',       email: 'h.yoshida@lenard.jp',     role: 'staff' },
  { name: '大岩 龍喜',     email: 'oiwa@lenard.jp',          role: 'leader' },
  { name: '小山 智子',     email: 't.koyama@lenard.jp',      role: 'staff' },
  { name: '小笠原 昇太郎', email: 's.ogasawara@lenard.jp',   role: 'staff' },
  { name: '川津 知紘',     email: 'kawatsu@lenard.jp',       role: 'staff' },
  { name: '後藤 裕美子',   email: 'y.goto@lenard.jp',        role: 'staff' },
  { name: '松田 剛',       email: 'matsuda@lenard.jp',       role: 'staff' },
  { name: '橋本 賢一',     email: 'hashimoto@lenard.jp',     role: 'staff' },
  { name: '田村 優平',     email: 'y.tamura@lenard.jp',      role: 'staff' },
  { name: '稲垣 知里',     email: 'inagaki@lenard.jp',       role: 'staff' },
  { name: '藤野 由美佳',   email: 'fujino@lenard.jp',        role: 'staff' },
  { name: '飯田 祐大',     email: 'y.iida@lenard.jp',        role: 'staff' },
  { name: '高橋 紀樹',     email: 'n.takahashi@lenard.jp',   role: 'staff' },
]

const managerEmailMap: Record<string, string> = {
  '千葉 亜矢子':   'aya@lenard.jp',
  '松田 剛':       'aya@lenard.jp',
  '藤野 由美佳':   'goshima@lenard.jp',
  '稲垣 知里':     'goshima@lenard.jp',
  '高橋 紀樹':     'nakamura@lenard.jp',
  '田村 優平':     'nakamura@lenard.jp',
  '橋本 賢一':     'nakamura@lenard.jp',
  '小山 智子':     'nakamura@lenard.jp',
  '小笠原 昇太郎': 'oiwa@lenard.jp',
  '飯田 祐大':     'oiwa@lenard.jp',
  '川津 知紘':     'oiwa@lenard.jp',
  '後藤 裕美子':   'mihara@lenard.jp',
  '大岩 龍喜':     'mihara@lenard.jp',
  '中村 和彦':     'mihara@lenard.jp',
  '五島 久美子':   'mihara@lenard.jp',
}

async function main() {
  console.log('🚀 社員アカウント一括作成開始...\n')

  // Step1: Authアカウント作成 + auth_user_id・role更新
  for (const user of users) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: 'Lenard1225',
        email_confirm: true,
      })
      if (error) {
        console.log(`⚠️  ${user.name} スキップ: ${error.message}`)
        continue
      }
      await supabaseAdmin
        .from('employees')
        .update({ auth_user_id: data.user.id, role: user.role })
        .eq('email', user.email)
      console.log(`✅ ${user.name} (${user.email}) 作成完了`)
    } catch (e) {
      console.log(`❌ ${user.name} エラー:`, e)
    }
  }

  // Step2: manager_id設定
  console.log('\n📋 manager_id設定中...')
  const { data: allEmployees } = await supabaseAdmin
    .from('employees')
    .select('id, name, email')

  for (const [staffName, managerEmail] of Object.entries(managerEmailMap)) {
    const staff = allEmployees?.find(e => e.name === staffName)
    const manager = allEmployees?.find(e => e.email === managerEmail)
    if (staff && manager) {
      await supabaseAdmin
        .from('employees')
        .update({ manager_id: manager.id })
        .eq('id', staff.id)
      console.log(`✅ ${staffName} → 上司: ${managerEmail}`)
    }
  }
  console.log('\n🎉 完了！')
}

main()
