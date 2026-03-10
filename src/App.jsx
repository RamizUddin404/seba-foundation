import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

// --- Supabase Configuration ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

const isSupabaseConfigured = SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_KEY !== 'YOUR_SUPABASE_ANON_KEY';
const supabase = isSupabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

function App() {
  const [requests, setRequests] = useState(() => JSON.parse(localStorage.getItem('seba_requests')) || [
    { id: 1, patient_name: 'করিম মিয়া', blood_group: 'A+', location: 'ঢাকা মেডিকেল', phone: '01700000000', posted_by: 'admin@seba.com', created_at: new Date().toISOString() },
    { id: 2, patient_name: 'রহিমা বেগম', blood_group: 'O-', location: 'চট্টগ্রাম হাসপাতাল', phone: '01800000000', posted_by: 'admin@seba.com', created_at: new Date().toISOString() }
  ]);
  const [users, setUsers] = useState(() => JSON.parse(localStorage.getItem('seba_users')) || [
    { email: 'admin@seba.com', password: 'admin', name: 'অ্যাডমিন', role: 'admin' }
  ]);
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem('seba_current_user')) || null);
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(false);
  const [filterGroup, setFilterGroup] = useState('All');

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  useEffect(() => {
    if (isSupabaseConfigured) fetchRequests();
  }, []);

  const fetchRequests = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      let { data, error } = await supabase.from('blood_requests').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        setRequests(data);
        localStorage.setItem('seba_requests', JSON.stringify(data));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (currentUser) localStorage.setItem('seba_current_user', JSON.stringify(currentUser));
    else localStorage.removeItem('seba_current_user');
    localStorage.setItem('seba_users', JSON.stringify(users));
  }, [currentUser, users]);

  const handleAuth = (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const pass = e.target.password.value;
    const user = users.find(u => u.email === email && u.password === pass);
    if (user) {
      setCurrentUser(user);
      setActiveTab('home');
    } else alert('ভুল ইমেইল বা পাসওয়ার্ড!');
  };

  const submitToDB = async (e) => {
    e.preventDefault();
    setLoading(true);
    const newReq = {
      id: Date.now(),
      patient_name: e.target.pname.value,
      blood_group: e.target.bgroup.value,
      location: e.target.loc.value,
      phone: e.target.phone.value,
      posted_by: currentUser.email,
      created_at: new Date().toISOString()
    };

    if (supabase) {
      const { error } = await supabase.from('blood_requests').insert([newReq]);
      if (!error) {
        alert('সফলভাবে ডাটাবেসে সেভ হয়েছে! 🩸');
        fetchRequests();
        setActiveTab('live');
      } else {
        saveLocal(newReq);
      }
    } else {
      saveLocal(newReq);
      alert('ডেমো মোড: লোকাল স্টোরেজে সেভ হয়েছে! 🩸');
      setActiveTab('live');
    }
    setLoading(false);
  };

  const saveLocal = (req) => {
    const updated = [req, ...requests];
    setRequests(updated);
    localStorage.setItem('seba_requests', JSON.stringify(updated));
  };

  const deleteReq = async (id) => {
    if (!window.confirm('ডিলিট করতে চান?')) return;
    if (supabase) {
      const { error } = await supabase.from('blood_requests').delete().eq('id', id);
      if (!error) fetchRequests();
    } else {
      const updated = requests.filter(r => r.id !== id);
      setRequests(updated);
      localStorage.setItem('seba_requests', JSON.stringify(updated));
    }
  };

  if (!currentUser) return (
    <div className="login-screen">
      <div className="login-card-modern">
        <h1>Seba</h1>
        <p>রক্তদাতার ডিজিটাল প্ল্যাটফর্ম</p>
        <form onSubmit={handleAuth} className="modern-form">
          <input type="email" name="email" placeholder="ইমেইল (admin@seba.com)" required />
          <input type="password" name="password" placeholder="পাসওয়ার্ড (admin)" required />
          <button type="submit" className="btn-login">লগইন করুন</button>
        </form>
        {!isSupabaseConfigured && <div style={{marginTop:'20px', color:'#f43f5e', fontSize:'0.8rem'}}>⚠️ বর্তমানে ডেমো মোডে চলছে (Supabase Keys Missing)</div>}
      </div>
    </div>
  );

  return (
    <div className="app-main">
      <nav className="top-nav">
        <div className="nav-brand" onClick={() => setActiveTab('home')}>
          <span className="logo-icon">🩸</span>
          <div className="brand-txt"><h2>Seba</h2><span>BLOOD NETWORK</span></div>
        </div>
        <ul className="nav-menu">
          <li className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>হোম</li>
          <li className={activeTab === 'request' ? 'active' : ''} onClick={() => setActiveTab('request')}>আবেদন</li>
          <li className={activeTab === 'live' ? 'active' : ''} onClick={() => setActiveTab('live')}>লাইভ লিস্ট</li>
          <li className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>প্রোফাইল</li>
        </ul>
        <div className="nav-user" onClick={() => setActiveTab('profile')}>
          <img src={`https://ui-avatars.com/api/?name=${currentUser.name}&background=ef4444&color=fff`} style={{width:'40px', borderRadius:'50%'}} alt="me" />
        </div>
      </nav>

      <main className="content-view">
        {activeTab === 'home' && (
          <section className="hero-section">
            <div className="hero-text">
              <h1>রক্ত দিন,<br/><span>জীবন বাঁচান</span></h1>
              <p>সেবা ফাউন্ডেশন - মানবতার কল্যাণে একটি ডিজিটাল রক্তদাতার প্ল্যাটফর্ম। আপনার এক ব্যাগ রক্ত বাঁচাতে পারে একটি প্রাণ।</p>
              <div className="hero-btns">
                <button className="btn-main" onClick={() => setActiveTab('request')}>রক্তের আবেদন</button>
                <button className="btn-glass" onClick={() => setActiveTab('live')}>লাইভ লিস্ট</button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'request' && (
          <section style={{padding:'4rem 8%', display:'flex', justifyContent:'center'}}>
            <div className="form-card">
              <h2 style={{fontSize:'2.5rem', marginBottom:'2rem', textAlign:'center'}}>রক্তের আবেদন ফরম</h2>
              <form onSubmit={submitToDB} style={{display:'grid', gap:'1.5rem'}}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem'}}>
                  <div className="field"><label>রোগীর নাম</label><input name="pname" required /></div>
                  <div className="field">
                    <label>রক্তের গ্রুপ</label>
                    <select name="bgroup" required>
                      <option value="">সিলেক্ট করুন</option>
                      {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>হাসপাতাল ও ঠিকানা</label><input name="loc" required /></div>
                  <div className="field"><label>মোবাইল নম্বর</label><input name="phone" type="tel" required /></div>
                </div>
                <button type="submit" className="btn-main" style={{width:'100%', marginTop:'1rem'}}>আবেদন পোস্ট করুন</button>
              </form>
            </div>
          </section>
        )}

        {activeTab === 'live' && (
          <section className="list-page">
            <div className="list-header">
              <h2 style={{fontSize:'2.5rem'}}>লাইভ রিকোয়েস্ট</h2>
              <select onChange={(e) => setFilterGroup(e.target.value)} className="btn-glass" style={{padding:'10px 20px', fontSize:'1rem'}}>
                <option value="All">সব গ্রুপ</option>
                {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>
            <div className="request-grid">
              {requests.filter(r => filterGroup === 'All' || r.blood_group === filterGroup).map(req => (
                <div key={req.id} className="request-card-premium">
                  <div className="card-badge">{req.blood_group}</div>
                  <div className="card-body">
                    <h3>{req.patient_name}</h3>
                    <p>📍 {req.location}</p>
                    <p>📞 {req.phone}</p>
                  </div>
                  <button className="btn-call" onClick={() => window.open(`tel:${req.phone}`)}>কল দিন</button>
                  {currentUser.email === req.posted_by && <button onClick={() => deleteReq(req.id)} style={{background:'none', border:'none', color:'#f43f5e', marginTop:'10px', cursor:'pointer', fontWeight:'bold'}}>ডিলিট করুন</button>}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'profile' && (
          <section style={{padding:'4rem 8%', display:'flex', justifyContent:'center'}}>
            <div className="form-card" style={{textAlign:'center', maxWidth:'500px'}}>
              <img src={`https://ui-avatars.com/api/?name=${currentUser.name}&size=128&background=ef4444&color=fff`} style={{borderRadius:'50%', marginBottom:'1rem', border:'4px solid var(--blood)'}} alt="avatar" />
              <h2 style={{fontSize:'2rem'}}>{currentUser.name}</h2>
              <p style={{color:'var(--text-dim)', marginBottom:'2rem'}}>{currentUser.email}</p>
              <button className="btn-glass" onClick={() => setCurrentUser(null)} style={{color:'#f43f5e'}}>লগআউট</button>
            </div>
          </section>
        )}
      </main>

      <footer className="main-footer">
        <p>&copy; 2026 Seba Blood Bank | Created with ❤️ for Humanity</p>
      </footer>
    </div>
  );
}

export default App;
