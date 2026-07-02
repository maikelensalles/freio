import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useApp } from '../../hooks/AppContext';
import { supabase } from '../../src/lib/supabase';

// ─── Tipos ─────────────────────────────────────────────────────────────────────
type Bucket = 'FIXED_50' | 'VARIABLE_30' | 'RESERVE_20';

type Category = {
  id: string;
  name: string;
  bucket: Bucket;
  icon: string;
};

type Transaction = {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category_id: string | null;
  created_at: string;
  is_impulse_purchase: boolean;
  categories: { name: string; bucket: Bucket; icon: string } | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, string> = {
  'piggy-bank':    'save-outline',
  'utensils':      'restaurant-outline',
  'home':          'home-outline',
  'car':           'car-outline',
  'heart':         'heart-outline',
  'book':          'book-outline',
  'music':         'musical-notes-outline',
  'shopping-cart': 'cart-outline',
  'coffee':        'cafe-outline',
  'zap':           'flash-outline',
  'wifi':          'wifi-outline',
  'smartphone':    'phone-portrait-outline',
};
function ionicon(dbIcon: string): string {
  return ICON_MAP[dbIcon] ?? 'ellipse-outline';
}

const BUCKET_META = {
  FIXED_50:    { label: 'Fixos 50%',    color: '#6366F1', pct: 0.50, description: 'Aluguel, internet, assinaturas...' },
  VARIABLE_30: { label: 'Variável 30%', color: '#F59E0B', pct: 0.30, description: 'Alimentação, lazer, transporte...' },
  RESERVE_20:  { label: 'Reserva 20%', color: '#10B981', pct: 0.20, description: 'Poupança, investimentos...' },
};

function monthRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { start, end };
}

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ─── Componente ────────────────────────────────────────────────────────────────
export default function CalendarScreen() {
  const { user, monthlyIncome: baseIncome, setMonthlyIncome } = useApp();

  const [categories, setCategories]     = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);

  const [expandedCat, setExpandedCat]   = useState<string | null>(null);

  const [showForm, setShowForm]         = useState(false);
  const [formCatId, setFormCatId]       = useState('');
  const [formDesc, setFormDesc]         = useState('');
  const [formAmount, setFormAmount]     = useState('');

  const [showIncomeInput, setShowIncomeInput] = useState(false);
  const [incomeText, setIncomeText]           = useState('');

  // ── Supabase ─────────────────────────────────────────────────────────────────
  async function fetchAll() {
    setLoading(true);
    const { start, end } = monthRange();

    const [catRes, txRes] = await Promise.all([
      supabase.from('categories').select('*'),
      supabase
        .from('transactions')
        .select('*, categories(name, bucket, icon)')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false }),
    ]);

    if (catRes.data) setCategories(catRes.data as Category[]);
    if (txRes.data)  setTransactions(txRes.data as Transaction[]);
    setLoading(false);
  }

  async function saveExpense() {
    if (!formDesc.trim() || !formAmount || !formCatId) {
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return;
    }
    if (!user) { Alert.alert('Erro', 'Usuário não autenticado.'); return; }
    const parsed = parseFloat(formAmount.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) { Alert.alert('Valor inválido'); return; }

    const { error } = await supabase.from('transactions').insert([{
      description:        formDesc.trim(),
      amount:             parsed,
      type:               'expense',
      category_id:        formCatId,
      is_impulse_purchase: false,
      user_id:            user.id,
    }]);
    if (error) { Alert.alert('Erro', error.message); return; }

    setFormDesc(''); setFormAmount(''); setShowForm(false);
    fetchAll();
  }

  async function deleteTransaction(id: string, desc: string) {
    Alert.alert('Excluir', `Remover "${desc}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        await supabase.from('transactions').delete().eq('id', id);
        fetchAll();
      }},
    ]);
  }

  useEffect(() => { fetchAll(); }, []);

  // ── Totais derivados ─────────────────────────────────────────────────────────
  const expenses        = transactions.filter(t => t.type === 'expense');
  const variableIncome  = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalDisponivel = baseIncome + variableIncome;
  const grandTotal      = expenses.reduce((s, t) => s + Number(t.amount), 0);

  function totalForCat(catId: string) {
    return expenses
      .filter(t => t.category_id === catId)
      .reduce((s, t) => s + Number(t.amount), 0);
  }

  function totalForBucket(bucket: Bucket) {
    return expenses
      .filter(t => t.categories?.bucket === bucket)
      .reduce((s, t) => s + Number(t.amount), 0);
  }

  const now = new Date();

  if (loading)
    return <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /></View>;

  // ─── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>agenda</Text>
          <Text style={styles.headerSub}>{MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</Text>
        </View>

        {/* ── Resumo do mês ── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryLabel}>TOTAL GASTO NO MÊS</Text>
              <Text style={styles.summaryValue}>R$ {grandTotal.toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={styles.incomeBtn} onPress={() => setShowIncomeInput(v => !v)}>
              <Text style={styles.incomeBtnText}>
                {baseIncome > 0 ? `Base: R$ ${baseIncome.toFixed(0)} ✏️` : '+ Renda Fixa Base'}
              </Text>
            </TouchableOpacity>
          </View>

          {showIncomeInput && (
            <View style={styles.incomeInputRow}>
              <TextInput
                placeholder="Salário fixo mensal"
                placeholderTextColor={C.textMuted}
                value={incomeText}
                onChangeText={setIncomeText}
                keyboardType="decimal-pad"
                style={styles.incomeInput}
              />
              <TouchableOpacity
                style={styles.incomeConfirm}
                onPress={() => {
                  const v = parseFloat(incomeText.replace(',', '.'));
                  if (!isNaN(v) && v > 0) { setMonthlyIncome(v); setShowIncomeInput(false); }
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>OK</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Breakdown: base + variável = disponível */}
          <View style={styles.incomeBreakdown}>
            <View style={styles.incomeBreakdownRow}>
              <Text style={styles.incomeBreakdownLabel}>Renda Fixa Base</Text>
              <Text style={styles.incomeBreakdownValue}>R$ {baseIncome.toFixed(2)}</Text>
            </View>
            <View style={styles.incomeBreakdownRow}>
              <Text style={styles.incomeBreakdownLabel}>Ganhos Variáveis</Text>
              <Text style={[styles.incomeBreakdownValue, { color: C.success }]}>
                + R$ {variableIncome.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.incomeBreakdownRow, styles.incomeBreakdownTotal]}>
              <Text style={styles.incomeBreakdownLabelTotal}>Total Disponível</Text>
              <Text style={styles.incomeBreakdownValueTotal}>R$ {totalDisponivel.toFixed(2)}</Text>
            </View>
          </View>

          {/* Barra de progresso geral */}
          {totalDisponivel > 0 && (
            <View style={{ marginTop: 12 }}>
              <View style={styles.progressBg}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(grandTotal / totalDisponivel * 100, 100)}%`,
                    backgroundColor: grandTotal > totalDisponivel ? C.danger : C.accent,
                  }
                ]} />
              </View>
              <Text style={styles.progressLabel}>
                {((grandTotal / totalDisponivel) * 100).toFixed(0)}% do disponível gasto
                {grandTotal > totalDisponivel ? '  ⚠️ Acima do limite!' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* ── Buckets 50-30-20 ── */}
        {(Object.keys(BUCKET_META) as Bucket[]).map(bucket => {
          const meta        = BUCKET_META[bucket];
          const bucketCats  = categories.filter(c => c.bucket === bucket);
          const bucketSpent = totalForBucket(bucket);
          const limit       = totalDisponivel * meta.pct;
          const over        = totalDisponivel > 0 && bucketSpent > limit;

          return (
            <View key={bucket} style={styles.bucketSection}>
              <View style={styles.bucketHeader}>
                <View style={[styles.bucketDot, { backgroundColor: meta.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bucketTitle}>{meta.label}</Text>
                  <Text style={styles.bucketDesc}>{meta.description}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.bucketTotal, over && { color: C.danger }]}>
                    R$ {bucketSpent.toFixed(2)}
                  </Text>
                  {totalDisponivel > 0 && (
                    <Text style={styles.bucketLimit}>limite R$ {limit.toFixed(0)}</Text>
                  )}
                </View>
              </View>

              {totalDisponivel > 0 && (
                <View style={[styles.progressBg, { marginBottom: 14 }]}>
                  <View style={[
                    styles.progressFill,
                    { width: `${Math.min(bucketSpent / limit * 100, 100)}%`, backgroundColor: over ? C.danger : meta.color }
                  ]} />
                </View>
              )}

              {bucketCats.map(cat => {
                const catTotal   = totalForCat(cat.id);
                const catTx      = expenses.filter(t => t.category_id === cat.id);
                const isExpanded = expandedCat === cat.id;

                return (
                  <View key={cat.id} style={styles.catBlock}>
                    <TouchableOpacity
                      style={styles.catRow}
                      onPress={() => setExpandedCat(isExpanded ? null : cat.id)}
                    >
                      <View style={[styles.catIconBox, { backgroundColor: meta.color + '22' }]}>
                        <Ionicons name={ionicon(cat.icon) as any} size={16} color={meta.color} />
                      </View>
                      <Text style={styles.catName}>{cat.name}</Text>
                      <Text style={styles.catTotal}>R$ {catTotal.toFixed(2)}</Text>
                      <TouchableOpacity
                        style={styles.catAddBtn}
                        onPress={() => { setFormCatId(cat.id); setShowForm(true); }}
                      >
                        <Text style={styles.catAddBtnText}>+</Text>
                      </TouchableOpacity>
                      <Text style={[styles.catChevron, isExpanded && { transform: [{ rotate: '90deg' }] }]}>›</Text>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.txList}>
                        {catTx.length === 0 ? (
                          <Text style={styles.txEmpty}>Nenhum gasto nesta categoria este mês.</Text>
                        ) : (
                          catTx.map(t => (
                            <TouchableOpacity
                              key={t.id}
                              style={styles.txRow}
                              onLongPress={() => deleteTransaction(t.id, t.description)}
                              delayLongPress={400}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.txDesc}>{t.description}</Text>
                                <Text style={styles.txDate}>
                                  {new Date(t.created_at).toLocaleDateString('pt-BR')}
                                  {t.is_impulse_purchase ? '  🔴 impulso' : ''}
                                </Text>
                              </View>
                              <Text style={styles.txAmount}>R$ {Number(t.amount).toFixed(2)}</Text>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}

      </ScrollView>

      {/* ── Modal: novo gasto rápido ── */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              + Gasto em {categories.find(c => c.id === formCatId)?.name ?? ''}
            </Text>

            <TextInput
              placeholder="Descrição"
              placeholderTextColor={C.textMuted}
              value={formDesc}
              onChangeText={setFormDesc}
              style={styles.input}
            />
            <TextInput
              placeholder="Valor"
              placeholderTextColor={C.textMuted}
              value={formAmount}
              onChangeText={setFormAmount}
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => { setShowForm(false); setFormDesc(''); setFormAmount(''); }}
              >
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={saveExpense}>
                <Text style={styles.btnSaveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:         '#0F1015',
  surface:    '#1A1C24',
  surfaceAlt: '#22242E',
  border:     '#2D3042',
  accent:     '#6366F1',
  success:    '#10B981',
  danger:     '#F87171',
  text:       '#F3F4F6',
  textSub:    '#9CA3AF',
  textMuted:  '#6B7280',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  // Header
  header:    { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 20 },
  appName:   { fontSize: 32, fontWeight: '800', color: C.text, letterSpacing: -1 },
  headerSub: { fontSize: 13, color: C.textMuted, marginTop: 2, letterSpacing: 2, textTransform: 'uppercase' },

  // Summary card
  summaryCard: {
    marginHorizontal: 24, marginBottom: 28, backgroundColor: C.surface,
    borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border,
  },
  summaryTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryLabel: { fontSize: 10, color: C.textMuted, letterSpacing: 1.5, fontWeight: '700', marginBottom: 4 },
  summaryValue: { fontSize: 28, fontWeight: '800', color: C.text },
  incomeBtn:    { backgroundColor: C.surfaceAlt, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  incomeBtnText:{ color: C.accent, fontSize: 12, fontWeight: '700' },
  incomeInputRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  incomeInput: {
    flex: 1, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.accent,
    borderRadius: 10, padding: 12, color: C.text, fontSize: 15,
  },
  incomeConfirm: {
    backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
  },

  // Income breakdown
  incomeBreakdown:      { marginTop: 16, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, gap: 8 },
  incomeBreakdownRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  incomeBreakdownLabel: { color: C.textMuted, fontSize: 12 },
  incomeBreakdownValue: { color: C.textSub, fontSize: 12, fontWeight: '600' },
  incomeBreakdownTotal: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, marginTop: 2 },
  incomeBreakdownLabelTotal: { color: C.textSub, fontSize: 13, fontWeight: '700' },
  incomeBreakdownValueTotal: { color: C.text, fontSize: 14, fontWeight: '800' },

  // Progress
  progressBg:    { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: 6, borderRadius: 3 },
  progressLabel: { color: C.textMuted, fontSize: 11, marginTop: 6, textAlign: 'right' },

  // Bucket sections
  bucketSection: { paddingHorizontal: 24, marginBottom: 24 },
  bucketHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  bucketDot:     { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  bucketTitle:   { color: C.text, fontWeight: '700', fontSize: 14 },
  bucketDesc:    { color: C.textMuted, fontSize: 11, marginTop: 1 },
  bucketTotal:   { color: C.text, fontWeight: '700', fontSize: 14 },
  bucketLimit:   { color: C.textMuted, fontSize: 11 },

  // Category rows
  catBlock: { backgroundColor: C.surface, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  catRow:   { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  catIconBox:    { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catName:       { flex: 1, color: C.text, fontWeight: '600', fontSize: 14 },
  catTotal:      { color: C.textSub, fontWeight: '700', fontSize: 14 },
  catAddBtn:     { width: 28, height: 28, borderRadius: 8, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  catAddBtnText: { color: C.accent, fontSize: 18, lineHeight: 22, fontWeight: '700' },
  catChevron:    { color: C.textMuted, fontSize: 20, marginLeft: 4 },

  // Transaction list
  txList:   { borderTopWidth: 1, borderTopColor: C.border },
  txEmpty:  { color: C.textMuted, fontSize: 13, padding: 16, textAlign: 'center', fontStyle: 'italic' },
  txRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border + '66',
  },
  txDesc:   { color: C.text, fontSize: 13, fontWeight: '500' },
  txDate:   { color: C.textMuted, fontSize: 11, marginTop: 2 },
  txAmount: { color: C.accent, fontWeight: '700', fontSize: 13 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: 48,
  },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 20 },
  input: {
    backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 16, color: C.text, fontSize: 15, marginBottom: 12,
  },
  modalActions:  { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnCancel:     { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnCancelText: { color: C.textSub, fontWeight: '600' },
  btnSave:       { flex: 1, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnSaveText:   { color: '#fff', fontWeight: '800' },
});
