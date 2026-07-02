import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useApp } from '../hooks/AppContext';


const C = {
  bg:         '#0F1015',
  surface:    '#1A1C24',
  surfaceAlt: '#22242E',
  border:     '#2D3042',
  accent:     '#6366F1',
  danger:     '#F87171',
  text:       '#F3F4F6',
  textSub:    '#9CA3AF',
  textMuted:  '#6B7280',
};

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail } = useApp();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  // ✅ Feedback inline ao criar conta (sem Alert, sem confirmar e-mail)
  const [success, setSuccess]   = useState('');

  async function handleSubmit() {
    setError('');
    setSuccess('');

    if (!email.trim() || !password) { setError('Preencha e-mail e senha.'); return; }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres.'); return; }

    setLoading(true);
    const err = isSignUp
      ? await signUpWithEmail(email.trim(), password)
      : await signInWithEmail(email.trim(), password);
    setLoading(false);

    if (err) {
      // ✅ "Email not confirmed" nunca vai aparecer — confirmação desativada
      const msg: Record<string, string> = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'User already registered':   'Este e-mail já está cadastrado. Tente entrar.',
        'Password should be at least 6 characters': 'Senha muito curta (mínimo 6 caracteres).',
      };
      setError(msg[err.message] ?? err.message);
      return;
    }

    // ✅ Signup sem confirmação de e-mail → sessão já ativa, _layout redireciona sozinho.
    // Só mostramos feedback visual por 1s antes do redirect automático.
    if (isSignUp) {
      setSuccess('Conta criada! Entrando...');
    }
    // Não precisa de nenhum navigate() — o Redirect no _layout.tsx cuida disso
    // assim que o onAuthStateChange atualiza a sessão.
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>

        {/* Logo */}
        <View style={styles.logoArea}>
          <Text style={styles.logo}>freio.</Text>
          <Text style={styles.logoSub}>controle financeiro pessoal</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isSignUp ? 'Criar conta' : 'Entrar'}</Text>

          {/* Erro */}
          {error ? (
            <View style={styles.feedbackBox}>
              <Text style={styles.errorText}>⚠ {error}</Text>
            </View>
          ) : null}

          {/* Sucesso (signup sem confirmação) */}
          {success ? (
            <View style={[styles.feedbackBox, styles.successBox]}>
              <Text style={styles.successText}>✓ {success}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor={C.textMuted}
            value={email}
            onChangeText={t => { setEmail(t); setError(''); setSuccess(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder={isSignUp ? 'Mínimo 6 caracteres' : '••••••••'}
            placeholderTextColor={C.textMuted}
            value={password}
            onChangeText={t => { setPassword(t); setError(''); setSuccess(''); }}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{isSignUp ? 'Criar conta' : 'Entrar'}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Toggle */}
        <TouchableOpacity onPress={() => { setIsSignUp(v => !v); setError(''); setSuccess(''); }}>
          <Text style={styles.toggleText}>
            {isSignUp ? 'Já tem conta?  ' : 'Não tem conta?  '}
            <Text style={styles.toggleLink}>
              {isSignUp ? 'Entrar' : 'Criar agora'}
            </Text>
          </Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 24 },

  logoArea:  { alignItems: 'center', marginBottom: 8 },
  logo:      { fontSize: 48, fontWeight: '800', color: C.text, letterSpacing: -2 },
  logoSub:   { fontSize: 13, color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },

  card: {
    backgroundColor: C.surface, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, padding: 24, gap: 4,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 16 },

  feedbackBox: {
    backgroundColor: '#F871711A', borderWidth: 1, borderColor: C.danger,
    borderRadius: 10, padding: 12, marginBottom: 12,
  },
  successBox:  { backgroundColor: '#10B98120', borderColor: '#10B981' },
  errorText:   { color: C.danger, fontSize: 13 },
  successText: { color: '#10B981', fontSize: 13 },

  label: { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.2, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 16, color: C.text, fontSize: 15, marginBottom: 4,
  },

  btn:         { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: '800', fontSize: 15 },

  toggleText: { color: C.textMuted, fontSize: 14, textAlign: 'center' },
  toggleLink: { color: C.accent, fontWeight: '700' },
});