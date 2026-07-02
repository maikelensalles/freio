import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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

type FlashButton = {
  label: string;
  amount: string;
  category_id: string;
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

const BUCKET_META: Record<Bucket, { label: string; color: string; pct: number }> = {
  FIXED_50:    { label: 'Fixos 50%',    color: '#6366F1', pct: 0.50 },
  VARIABLE_30: { label: 'Variável 30%', color: '#F59E0B', pct: 0.30 },
  RESERVE_20:  { label: 'Reserva 20%', color: '#10B981', pct: 0.20 },
};

const DEFAULT_FLASH: FlashButton[] = [
  { label: 'Café',   amount: '10', category_id: '' },
  { label: 'Uber',   amount: '25', category_id: '' },
  { label: 'Lanche', amount: '15', category_id: '' },
];

const EMPTY_FORM = { description: '', amount: '', category_id: '', is_impulse: false };

// ─── Componente ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user } = useApp();

  const [categories, setCategories]     = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);

  // Formulário de ganho
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [incomeDesc, setIncomeDesc]         = useState('');
  const [incomeAmount, setIncomeAmount]     = useState('');

  // Flash buttons
  const [flashButtons, setFlashButtons] = useState<FlashButton[]>(DEFAULT_FLASH);
  const [editingFlash, setEditingFlash] = useState<number | null>(null);
  const [flashDraft, setFlashDraft]     = useState<FlashButton>({ label: '', amount: '', category_id: '' });

  // Formulário de gasto manual
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);

  // Toast
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // ── Supabase ─────────────────────────────────────────────────────────────────
  async function fetchCategories() {
    const { data, error } = await supabase.from('categories').select('*');
    if (error) {
      Alert.alert('Erro', `Não consegui carregar categorias:\n${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      Alert.alert('Aviso', 'Nenhuma categoria disponível no banco de dados');
      return;
    }
    setCategories(data as Category[]);
    setFlashButtons(prev =>
      prev.map(b => ({ ...b, category_id: b.category_id || data[0]?.id || '' }))
    );
    setForm(p => ({ ...p, category_id: p.category_id || data[0]?.id || '' }));
  }

  async function fetchTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(name, bucket, icon)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      Alert.alert('Erro', `Não foi possível carregar transações:\n${error.message}`);
    }
    if (data) setTransactions(data as Transaction[]);
    setLoading(false);
  }

  async function saveIncome() {
    if (!incomeDesc.trim()) { Alert.alert('Atenção', 'Descreva o ganho (ex: Salário, Freela).'); return; }
    if (!incomeAmount)      { Alert.alert('Atenção', 'Informe o valor recebido.'); return; }
    if (!user)              { Alert.alert('Erro', 'Usuário não autenticado.'); return; }
    const parsed = parseFloat(incomeAmount.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) { Alert.alert('Valor inválido', 'Digite um número maior que zero.'); return; }

    const { error } = await supabase.from('transactions').insert([{
      description:        incomeDesc.trim(),
      amount:             parsed,
      type:               'income',
      category_id:        null,
      is_impulse_purchase: false,
      user_id:            user.id,
    }]);
    if (error) { Alert.alert('Erro', error.message); return; }
    fetchTransactions();
    showFeedback(`✓ Ganho R$ ${parsed.toFixed(2)} registrado!`);
    setIncomeDesc(''); setIncomeAmount(''); setShowIncomeForm(false);
  }

  async function saveTransaction(desc: string, val: string, catId: string, isImpulse = false) {
    if (!desc.trim()) { Alert.alert('Atenção', 'Descrição está vazia'); return; }
    if (!val)         { Alert.alert('Atenção', 'Valor está vazio'); return; }
    if (!catId)       { Alert.alert('Atenção', 'Nenhuma categoria selecionada!'); return; }
    if (!user)        { Alert.alert('Erro', 'Usuário não autenticado.'); return; }
    const parsed = parseFloat(val.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) { Alert.alert('Valor inválido', 'Digite um número maior que zero.'); return; }

    const { error } = await supabase.from('transactions').insert([{
      description:        desc.trim(),
      amount:             parsed,
      type:               'expense',
      category_id:        catId,
      is_impulse_purchase: isImpulse,
      user_id:            user.id,
    }]);
    if (error) { Alert.alert('Erro', error.message); return; }
    fetchTransactions();
    showFeedback(`✓ ${desc}  R$ ${parsed.toFixed(2)}`);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function deleteTransaction(id: string, desc: string) {
    Alert.alert('Excluir', `Remover "${desc}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
          await supabase.from('transactions').delete().eq('id', id);
          fetchTransactions();
        }},
    ]);
  }

  // ── Toast ────────────────────────────────────────────────────────────────────
  function showFeedback(msg: string) {
    setFeedbackMsg(msg);
    feedbackAnim.setValue(1);
    Animated.sequence([
      Animated.delay(1800),
      Animated.timing(feedbackAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }

  // ── Flash edit ───────────────────────────────────────────────────────────────
  function openFlashEdit(i: number) {
    setFlashDraft({ ...flashButtons[i] });
    setEditingFlash(i);
  }
  function saveFlashEdit() {
    if (!flashDraft.label.trim() || !flashDraft.amount || !flashDraft.category_id) return;
    setFlashButtons(prev => {
      const u = [...prev];
      u[editingFlash!] = { ...flashDraft };
      return u;
    });
    setEditingFlash(null);
  }

  // ── Totais do mês atual ──────────────────────────────────────────────────────
  function calcTotals() {
    const bucketSpend: Record<Bucket, number> = { FIXED_50: 0, VARIABLE_30: 0, RESERVE_20: 0 };
    let incomeTotal = 0;
    const now = new Date();
    transactions.forEach(t => {
      const d = new Date(t.created_at);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        if (t.type === 'income') {
          incomeTotal += Number(t.amount);
        } else {
          const b = t.categories?.bucket;
          if (b) bucketSpend[b] += Number(t.amount);
        }
      }
    });
    return { bucketSpend, incomeTotal };
  }

  useEffect(() => { fetchCategories(); fetchTransactions(); }, []);

  const { bucketSpend, incomeTotal } = calcTotals();
  const expenses = transactions.filter(t => t.type === 'expense');

  if (loading)
    return <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /></View>;

  // ─── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Toast */}
      <Animated.View style={[styles.toast, { opacity: feedbackAnim }]}>
        <Text style={styles.toastText}>{feedbackMsg}</Text>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>freio</Text>
          <View style={styles.headerIncomeRow}>
            <Text style={styles.headerSub}>
              {incomeTotal > 0
                ? `ganhos este mês: R$ ${incomeTotal.toFixed(2)}`
                : 'nenhum ganho registrado'}
            </Text>
            <TouchableOpacity onPress={() => setShowIncomeForm(true)} style={styles.incomeChip}>
              <Text style={styles.incomeChipText}>+ ganho</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Termômetro 50-30-20 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TERMÔMETRO 50 · 30 · 20</Text>
          {(Object.keys(BUCKET_META) as Bucket[]).map(bucket => {
            const meta  = BUCKET_META[bucket];
            const spent = bucketSpend[bucket];
            const limit = incomeTotal * meta.pct;
            const pct   = limit > 0 ? Math.min(spent / limit, 1) : 0;
            const over  = limit > 0 && spent > limit;
            return (
              <View key={bucket} style={styles.thermRow}>
                <View style={styles.thermLeft}>
                  <Text style={styles.thermLabel}>{meta.label}</Text>
                  <Text style={[styles.thermValues, over && { color: C.danger }]}>
                    R$ {spent.toFixed(0)}{limit > 0 ? ` / R$ ${limit.toFixed(0)}` : ''}
                  </Text>
                </View>
                <View style={styles.thermBarBg}>
                  <View style={[
                    styles.thermBarFill,
                    { width: `${pct * 100}%`, backgroundColor: over ? C.danger : meta.color }
                  ]} />
                </View>
              </View>
            );
          })}
          {incomeTotal === 0 && (
            <Text style={styles.thermHint}>↑ Registre um ganho para ver os limites</Text>
          )}
        </View>

        {/* ── Flash Buttons ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>ATALHOS RÁPIDOS</Text>
            <Text style={styles.sectionHint}>segure para editar</Text>
          </View>
          <View style={styles.flashRow}>
            {flashButtons.map((btn, i) => {
              const cat = categories.find(c => c.id === btn.category_id);
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.flashButton}
                  onPress={() => saveTransaction(btn.label, btn.amount, btn.category_id)}
                  onLongPress={() => openFlashEdit(i)}
                  delayLongPress={500}
                >
                  {cat && (
                    <Ionicons
                      name={ionicon(cat.icon) as any}
                      size={18}
                      color={C.accent}
                      style={{ marginBottom: 4 }}
                    />
                  )}
                  <Text style={styles.flashLabel}>{btn.label}</Text>
                  <Text style={styles.flashAmount}>R$ {parseFloat(btn.amount || '0').toFixed(0)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Botões de ação */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnIncome]} onPress={() => setShowIncomeForm(true)}>
            <Text style={styles.actionBtnText}>+ Registrar Ganho</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnExpense]} onPress={() => setShowForm(true)}>
            <Text style={styles.actionBtnText}>+ Registrar Gasto</Text>
          </TouchableOpacity>
        </View>

        {/* ── Últimos gastos ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ÚLTIMOS GASTOS</Text>
          {expenses.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum gasto ainda.</Text>
          ) : (
            expenses.slice(0, 20).map(item => {
              const bucket = item.categories?.bucket;
              const bMeta  = bucket ? BUCKET_META[bucket] : null;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.txCard}
                  onLongPress={() => deleteTransaction(item.id, item.description)}
                  delayLongPress={400}
                >
                  <View style={[styles.txIconBox, { backgroundColor: bMeta?.color ? bMeta.color + '22' : '#ffffff11' }]}>
                    <Ionicons
                      name={ionicon(item.categories?.icon ?? '') as any}
                      size={18}
                      color={bMeta?.color ?? C.textMuted}
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <View style={styles.txTitleRow}>
                      <Text style={styles.txDesc}>{item.description}</Text>
                      {item.is_impulse_purchase && (
                        <View style={styles.impulseBadge}>
                          <Text style={styles.impulseBadgeText}>impulso</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.txCat}>{item.categories?.name ?? '—'}</Text>
                  </View>
                  <Text style={styles.txAmount}>R$ {Number(item.amount).toFixed(2)}</Text>
                </TouchableOpacity>
              );
            })
          )}
          {expenses.length > 0 && (
            <Text style={styles.deleteHint}>Segure para excluir</Text>
          )}
        </View>

      </ScrollView>

      {/* ── Modal: Registrar Ganho ── */}
      <Modal visible={showIncomeForm} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Registrar Ganho</Text>

            <TextInput
              placeholder="Descrição  (ex: Salário, Freela, Pix)"
              placeholderTextColor={C.textMuted}
              value={incomeDesc}
              onChangeText={setIncomeDesc}
              style={styles.input}
            />
            <TextInput
              placeholder="Valor recebido  (ex: 3500,00)"
              placeholderTextColor={C.textMuted}
              value={incomeAmount}
              onChangeText={setIncomeAmount}
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => { setShowIncomeForm(false); setIncomeDesc(''); setIncomeAmount(''); }}
              >
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnSave, { backgroundColor: C.success }]} onPress={saveIncome}>
                <Text style={styles.btnSaveText}>Salvar Ganho</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Formulário manual de Gasto ── */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Novo Gasto</Text>

            <TextInput
              placeholder="Descrição  (ex: almoço)"
              placeholderTextColor={C.textMuted}
              value={form.description}
              onChangeText={t => setForm(p => ({ ...p, description: t }))}
              style={styles.input}
            />
            <TextInput
              placeholder="Valor  (ex: 32,50)"
              placeholderTextColor={C.textMuted}
              value={form.amount}
              onChangeText={t => setForm(p => ({ ...p, amount: t }))}
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {categories.map(cat => {
                const active = form.category_id === cat.id;
                const bColor = BUCKET_META[cat.bucket].color;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catChip, active && { backgroundColor: bColor, borderColor: bColor }]}
                    onPress={() => setForm(p => ({ ...p, category_id: cat.id }))}
                  >
                    <Ionicons name={ionicon(cat.icon) as any} size={14} color={active ? '#fff' : C.textSub} />
                    <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.impulseToggle}
              onPress={() => setForm(p => ({ ...p, is_impulse: !p.is_impulse }))}
            >
              <View style={[styles.impulseCheck, form.is_impulse && styles.impulseCheckOn]}>
                {form.is_impulse && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
              </View>
              <Text style={styles.impulseLabel}>Marcar como compra por impulso</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setShowForm(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnSave}
                onPress={() => saveTransaction(form.description, form.amount, form.category_id, form.is_impulse)}
              >
                <Text style={styles.btnSaveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Editar Flash ── */}
      <Modal visible={editingFlash !== null} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Editar Atalho #{(editingFlash ?? 0) + 1}</Text>

            <TextInput
              placeholder="Nome  (ex: Café)"
              placeholderTextColor={C.textMuted}
              value={flashDraft.label}
              onChangeText={t => setFlashDraft(p => ({ ...p, label: t }))}
              style={styles.input}
            />
            <TextInput
              placeholder="Valor padrão  (ex: 10)"
              placeholderTextColor={C.textMuted}
              value={flashDraft.amount}
              onChangeText={t => setFlashDraft(p => ({ ...p, amount: t }))}
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Categoria do atalho</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {categories.map(cat => {
                const active = flashDraft.category_id === cat.id;
                const bColor = BUCKET_META[cat.bucket].color;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catChip, active && { backgroundColor: bColor, borderColor: bColor }]}
                    onPress={() => setFlashDraft(p => ({ ...p, category_id: cat.id }))}
                  >
                    <Ionicons name={ionicon(cat.icon) as any} size={14} color={active ? '#fff' : C.textSub} />
                    <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setEditingFlash(null)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={saveFlashEdit}>
                <Text style={styles.btnSaveText}>Salvar Atalho</Text>
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
  accentL:    '#818CF8',
  success:    '#10B981',
  danger:     '#F87171',
  warning:    '#F59E0B',
  text:       '#F3F4F6',
  textSub:    '#9CA3AF',
  textMuted:  '#6B7280',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  // Toast
  toast: {
    position: 'absolute', top: 56, alignSelf: 'center', zIndex: 99,
    backgroundColor: C.success, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100,
  },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Header
  header:          { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 20 },
  appName:         { fontSize: 32, fontWeight: '800', color: C.text, letterSpacing: -1 },
  headerIncomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  headerSub:       { fontSize: 12, color: C.textMuted, flex: 1 },
  incomeChip: {
    backgroundColor: C.success + '22', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: C.success + '44',
  },
  incomeChipText: { color: C.success, fontSize: 11, fontWeight: '700' },

  // Seções
  section:      { paddingHorizontal: 24, marginBottom: 24 },
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  sectionHint:  { fontSize: 11, color: C.textMuted, fontStyle: 'italic' },
  emptyText:    { color: C.textMuted, textAlign: 'center', paddingVertical: 32, fontSize: 14 },

  // Termômetro
  thermRow:     { marginBottom: 14 },
  thermLeft:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  thermLabel:   { color: C.textSub, fontSize: 13, fontWeight: '600' },
  thermValues:  { color: C.textMuted, fontSize: 12 },
  thermBarBg:   { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  thermBarFill: { height: 6, borderRadius: 3 },
  thermHint:    { color: C.textMuted, fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },

  // Flash
  flashRow: { flexDirection: 'row', gap: 10 },
  flashButton: {
    flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  flashLabel:  { color: C.text, fontWeight: '700', fontSize: 13 },
  flashAmount: { color: C.accent, fontSize: 12, marginTop: 2 },

  // Botões de ação
  actionRow:         { flexDirection: 'row', gap: 12, marginHorizontal: 24, marginBottom: 28 },
  actionBtn:         { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  actionBtnIncome:   { backgroundColor: C.success },
  actionBtnExpense:  { backgroundColor: C.accent },
  actionBtnText:     { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Transaction cards
  txCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border, gap: 12,
  },
  txIconBox:  { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txInfo:     { flex: 1 },
  txTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txDesc:     { color: C.text, fontWeight: '600', fontSize: 14 },
  txCat:      { color: C.textMuted, fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  txAmount:   { color: C.accentL, fontWeight: '700', fontSize: 15 },
  deleteHint: { color: C.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },

  // Impulse badge
  impulseBadge:     { backgroundColor: C.danger + '33', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  impulseBadgeText: { color: C.danger, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: 48,
  },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 20 },

  // Inputs
  input: {
    backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 16, color: C.text, fontSize: 15, marginBottom: 12,
  },
  inputLabel: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },

  // Category chips
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: C.border, borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: C.surfaceAlt,
  },
  catChipText:       { color: C.textSub, fontSize: 13, fontWeight: '600' },
  catChipTextActive: { color: '#fff' },

  // Impulse toggle
  impulseToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  impulseCheck: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2,
    borderColor: C.danger, alignItems: 'center', justifyContent: 'center',
  },
  impulseCheckOn: { backgroundColor: C.danger, borderColor: C.danger },
  impulseLabel:   { color: C.textSub, fontSize: 13 },

  // Modal actions
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btnCancel: {
    flex: 1, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  btnCancelText: { color: C.textSub, fontWeight: '600' },
  btnSave:       { flex: 1, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnSaveText:   { color: '#fff', fontWeight: '800' },
});
