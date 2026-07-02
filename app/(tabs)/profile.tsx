import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useApp } from '../../hooks/AppContext';
import { supabase } from '../../src/lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Stats = {
  totalMonth: number;
  totalImpulse: number;
  countMonth: number;
  topCategory: string;
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:         '#0F1015',
  surface:    '#1A1C24',
  surfaceAlt: '#22242E',
  border:     '#2D3042',
  accent:     '#6366F1',
  accentL:    '#818CF8',
  success:    '#10B981',
  danger:     '#F87171',
  warning:    '#F59E0B',
  text:       '#F3F4F6',
  textSub:    '#9CA3AF',
  textMuted:  '#6B7280',
};

const FOUR_PS = [
  { icon: 'wallet-outline',      q: 'Posso pagar?' },
  { icon: 'time-outline',        q: 'Preciso disso agora?' },
  { icon: 'help-circle-outline', q: 'Para que quero isso?' },
  { icon: 'flag-outline',        q: 'Isso é uma prioridade?' },
];

const BUCKET_COLORS: Record<string, string> = {
  FIXED_50:    C.accent,
  VARIABLE_30: C.warning,
  RESERVE_20:  C.success,
};

// ─── Componente ───────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { user, signOut } = useApp();
  const [stats, setStats]   = useState<Stats | null>(null);

  // Iniciais do avatar a partir do e-mail
  const initials = (user?.email ?? '?')
    .split('@')[0]
    .slice(0, 2)
    .toUpperCase();

  // Mês atual para o label
  const now = new Date();
  const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  async function fetchStats() {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data } = await supabase
      .from('transactions')
      .select('amount, is_impulse_purchase, categories(name, bucket)')
      .gte('created_at', start)
      .lte('created_at', end);

    if (!data) return;

    const totalMonth   = data.reduce((s, t) => s + Number(t.amount), 0);
    const totalImpulse = data.filter(t => t.is_impulse_purchase).reduce((s, t) => s + Number(t.amount), 0);
    const countMonth   = data.length;

    // Categoria com maior gasto
    const catMap: Record<string, number> = {};
    data.forEach(t => {
      const name = (t.categories as any)?.name ?? 'Outros';
      catMap[name] = (catMap[name] ?? 0) + Number(t.amount);
    });
    const topCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    setStats({ totalMonth, totalImpulse, countMonth, topCategory });
  }

  async function handleSignOut() {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  }

  useEffect(() => { fetchStats(); }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header com avatar ── */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>perfil</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>● freio member</Text>
          </View>
        </View>
      </View>

      {/* ── Stats do mês ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>RESUMO DE {monthLabel.toUpperCase()}</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="card-outline" size={20} color={C.accent} />
            <Text style={styles.statValue}>
              R$ {stats ? stats.totalMonth.toFixed(2) : '—'}
            </Text>
            <Text style={styles.statLabel}>Total gasto</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="receipt-outline" size={20} color={C.warning} />
            <Text style={styles.statValue}>{stats?.countMonth ?? '—'}</Text>
            <Text style={styles.statLabel}>Registros</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="flash-outline" size={20} color={C.danger} />
            <Text style={[styles.statValue, stats && stats.totalImpulse > 0 && { color: C.danger }]}>
              R$ {stats ? stats.totalImpulse.toFixed(2) : '—'}
            </Text>
            <Text style={styles.statLabel}>Por impulso</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="pie-chart-outline" size={20} color={C.success} />
            <Text style={styles.statValue} numberOfLines={1}>
              {stats?.topCategory ?? '—'}
            </Text>
            <Text style={styles.statLabel}>Maior gasto</Text>
          </View>
        </View>
      </View>

      {/* ── Método 50·30·20 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>MÉTODO 50 · 30 · 20</Text>
        <View style={styles.card}>
          {[
            { bucket: 'FIXED_50',    pct: '50%', desc: 'Gastos fixos', ex: 'Aluguel, internet, assinaturas' },
            { bucket: 'VARIABLE_30', pct: '30%', desc: 'Gastos variáveis', ex: 'Alimentação, lazer, transporte' },
            { bucket: 'RESERVE_20',  pct: '20%', desc: 'Reserva & investimento', ex: 'Poupança, emergência, sonhos' },
          ].map((item, i, arr) => (
            <View key={item.bucket}>
              <View style={styles.bucketRow}>
                <View style={[styles.bucketDot, { backgroundColor: BUCKET_COLORS[item.bucket] }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.bucketTitleRow}>
                    <Text style={styles.bucketPct}>{item.pct}</Text>
                    <Text style={styles.bucketDesc}>{item.desc}</Text>
                  </View>
                  <Text style={styles.bucketEx}>{item.ex}</Text>
                </View>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </View>

      {/* ── Os 4 Ps ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>FREIO DE IMPULSO — OS 4 Ps</Text>
        <Text style={styles.sectionSub}>Antes de qualquer compra não planejada, pergunte:</Text>
        <View style={styles.card}>
          {FOUR_PS.map((p, i) => (
            <View key={i} style={[styles.fourPRow, i < FOUR_PS.length - 1 && { marginBottom: 16 }]}>
              <View style={styles.fourPNumber}>
                <Text style={styles.fourPNumberText}>{i + 1}</Text>
              </View>
              <Ionicons name={p.icon as any} size={18} color={C.textSub} style={{ marginRight: 10 }} />
              <Text style={styles.fourPText}>{p.q}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <Text style={styles.fourPTip}>
            Se responder <Text style={{ color: C.danger, fontWeight: '700' }}>Não</Text> para qualquer uma →{' '}
            <Text style={{ color: C.success, fontWeight: '700' }}>não compre.</Text>
          </Text>
        </View>
      </View>

      {/* ── Dicas rápidas ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>LEMBRE-SE SEMPRE</Text>
        <View style={styles.card}>
          {[
            '💡 Comece a guardar, mesmo que seja R$ 1.',
            '📉 Renda fixa ideal sempre deve ser a menor.',
            '🚫 Não conte com dinheiro que ainda não tem.',
            '🛡️ Esteja preparado para o imprevisível.',
            '📓 Anote todos os ganhos e gastos — sempre.',
          ].map((tip, i) => (
            <Text key={i} style={[styles.tip, i > 0 && { marginTop: 10 }]}>{tip}</Text>
          ))}
        </View>
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={18} color="#fff" />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>

      {/* ID do usuário (útil para debug no MVP) */}
      <Text style={styles.userId} numberOfLines={1}>
        uid: {user?.id}
      </Text>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 64 },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, marginBottom: 32 },
  avatar:      { width: 64, height: 64, borderRadius: 32, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerInfo:  { flex: 1 },
  title:       { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -1 },
  email:       { color: C.textMuted, fontSize: 12, marginTop: 2 },
  memberBadge: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: C.accent + '22', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  memberBadgeText: { color: C.accentL, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // Seções
  section:    { paddingHorizontal: 24, marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  sectionSub:   { fontSize: 12, color: C.textMuted, marginBottom: 12, fontStyle: 'italic' },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: C.surface,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 16, gap: 6,
  },
  statValue: { color: C.text, fontSize: 17, fontWeight: '800' },
  statLabel: { color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Card genérico
  card: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 20 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },

  // Bucket rows
  bucketRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bucketDot:     { width: 10, height: 10, borderRadius: 5, marginTop: 5, flexShrink: 0 },
  bucketTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  bucketPct:     { color: C.text, fontWeight: '800', fontSize: 15 },
  bucketDesc:    { color: C.textSub, fontSize: 13, fontWeight: '600' },
  bucketEx:      { color: C.textMuted, fontSize: 11 },

  // 4 Ps
  fourPRow:       { flexDirection: 'row', alignItems: 'center' },
  fourPNumber:    { width: 24, height: 24, borderRadius: 12, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 },
  fourPNumberText:{ color: C.accent, fontSize: 12, fontWeight: '800' },
  fourPText:      { color: C.textSub, fontSize: 14, flex: 1 },
  fourPTip:       { color: C.textMuted, fontSize: 12, lineHeight: 18 },

  // Tips
  tip: { color: C.textSub, fontSize: 13, lineHeight: 20 },

  // Logout
  logoutBtn: {
    marginHorizontal: 24, backgroundColor: '#1e1015',
    borderWidth: 1, borderColor: C.danger,
    borderRadius: 12, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  logoutText: { color: C.danger, fontWeight: '800', fontSize: 15 },

  // Debug uid
  userId: { color: C.border, fontSize: 10, textAlign: 'center', marginTop: 16, paddingHorizontal: 24, fontFamily: 'monospace' },
});