import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Supabase credentials missing! Please check your .env file.");
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

function App() {
  const [session, setSession] = useState(null);
  const [requests, setRequests] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [myProfile, setMyProfile] = useState({
    full_name: '',
    blood_group: '',
    phone: '',
    location: '',
    address: '',
    bio: '',
    status: 'Active Donor'
  }); // Initialize with empty state so UI never disappears
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(false);
  const [authView, setAuthView] = useState('login');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBG, setFilterBG] = useState('All');
  const [selectedUser, setSelectedUser] = useState(null);

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const isAdmin = myProfile?.role === 'admin' || session?.user?.email === 'admin@seba.com';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        syncData();
      }
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) syncData();
      if (event === 'PASSWORD_RECOVERY') setAuthView('reset');
    });

    // Real-time subscription for blood requests
    const requestsSub = supabase
      .channel('blood_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blood_requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => {
      authSub.unsubscribe();
      supabase.removeChannel(requestsSub);
    };
  }, []);

  const syncData = async () => {
    fetchRequests();
    fetchProfiles();
    fetchMyProfile();
  };

  const fetchRequests = async () => {
    const { data } = await supabase.from('blood_requests').select('*').order('created_at', { ascending: false });
    if (data) setRequests(data);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setProfiles(data);
  };

  const fetchMyProfile = async () => {
    if (!session?.user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (data) {
      setMyProfile(data);
    }
  };

  const deleteRequest = async (id) => {
    if (window.confirm('আপনি কি এই আবেদনটি মুছে ফেলতে চান?')) {
      const { error } = await supabase.from('blood_requests').delete().eq('id', id);
      if (error) alert(error.message);
      else fetchRequests();
    }
  };

  const completeRequest = async (id) => {
    const { error } = await supabase.from('blood_requests').update({ status: 'completed' }).eq('id', id);
    if (error) alert(error.message);
    else fetchRequests();
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.target);
    const upd = {
      id: session.user.id,
      full_name: fd.get('name'),
      blood_group: fd.get('bgroup'),
      phone: fd.get('phone'),
      location: fd.get('loc'),
      address: fd.get('address'),
      bio: fd.get('bio'),
      status: fd.get('status'),
      updated_at: new Date()
    };

    const { error } = await supabase.from('profiles').upsert(upd);
    if (!error) {
      alert('প্রোফাইল সফলভাবে সেভ হয়েছে! ✨');
      fetchMyProfile();
      fetchProfiles();
    } else alert(error.message);
    setLoading(false);
  };

  const stats = useMemo(() => ({
    live: requests.filter(r => r.status === 'pending').length,
    success: requests.filter(r => r.status === 'completed').length,
    total: profiles.length
  }), [requests, profiles]);

  if (!session && authView !== 'reset') return (
    <div className="auth-container">
      <div className="auth-card glass animate-fade">
        <div className="auth-header"><h1>SEBA</h1><p>Digital Blood Network</p></div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          const fd = new FormData(e.target);
          const email = fd.get('email');
          const pass = fd.get('password');
          if (authView === 'login') {
            const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
            if (error) alert(error.message);
          } else {
            const { error } = await supabase.auth.signUp({ email, password: pass, options: { data: { full_name: fd.get('name'), blood_group: fd.get('bgroup') } } });
            if (error) alert(error.message); else alert('সফল! এখন লগইন করুন।');
          }
          setLoading(false);
        }}>
          {authView === 'signup' && (
            <>
              <input name="name" placeholder="নাম" required />
              <select name="bgroup" required><option value="">রক্তের গ্রুপ</option>{bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}</select>
            </>
          )}
          <input name="email" type="email" placeholder="ইমেইল" required />
          <input name="password" type="password" placeholder="পাসওয়ার্ড" required minLength={6} />
          <button type="submit" className="btn-primary" disabled={loading}>{authView === 'login' ? 'লগইন' : 'জয়েন করুন'}</button>
        </form>
        <p className="auth-footer" onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')}>
          {authView === 'login' ? "নতুন অ্যাকাউন্ট?" : "ইতিমধ্যে জয়েন করেছেন?"}
        </p>
      </div>
    </div>
  );

  return (
    <div className="app-main">
      <aside className="sidebar glass hide-mobile">
        <div className="logo-area" onClick={() => setActiveTab('home')}><div className="logo-icon">🩸</div><h2>SEBA</h2></div>
        <nav className="side-nav">
          <li className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>ড্যাশবোর্ড</li>
          <li className={activeTab === 'live' ? 'active' : ''} onClick={() => setActiveTab('live')}>লাইভ ফিড</li>
          <li className={activeTab === 'request' ? 'active' : ''} onClick={() => setActiveTab('request')}>রক্তের আবেদন</li>
          <li className={activeTab === 'donors' ? 'active' : ''} onClick={() => setActiveTab('donors')}>রক্তদাতা তালিকা</li>
          <li className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>আমার প্রোফাইল</li>
          <li onClick={() => supabase.auth.signOut()} className="logout-btn">লগআউট</li>
        </nav>
      </aside>

      <main className="content-container">
        <header className="mobile-header show-mobile">
          <div className="logo-icon">🩸</div><h2>SEBA</h2>
          <button onClick={() => supabase.auth.signOut()} className="btn-del-sm">Out</button>
        </header>

        {activeTab === 'home' && (
          <div className="home-view animate-fade">
            <div className="hero-pro glass">
              <h1>মানবতার ডিজিটাল সেবা</h1>
              <div className="pro-stats">
                <div className="stat-item"><h3>{stats.live}</h3><p>লাইভ আবেদন</p></div>
                <div className="stat-item"><h3>{stats.success}</h3><p>সফল হয়েছে</p></div>
                <div className="stat-item"><h3>{stats.total}</h3><p>মোট সদস্য</p></div>
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginTop:'2rem'}}>
               <button className="btn-primary" onClick={() => setActiveTab('request')}>জরুরী আবেদন</button>
               <button className="glass" style={{padding:'1rem'}} onClick={() => setActiveTab('donors')}>রক্তদাতা খুঁজুন</button>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="profile-view animate-fade">
            <h2 className="section-title">প্রোফাইল সেটিংস</h2>
            <div className="pro-profile-header glass">
              <div className="avatar-large">{myProfile.blood_group || '?'}</div>
              <div>
                <h2>{myProfile.full_name || 'আপনার নাম'}</h2>
                <p>{session.user.email}</p>
                <span className="badge-p">{myProfile.status}</span>
              </div>
            </div>

            <div className="glass form-container" style={{marginTop:'2rem', padding:'2.5rem'}}>
              <h3 style={{marginBottom:'1.5rem'}}>আপনার তথ্য আপডেট করুন</h3>
              <form onSubmit={saveProfile} className="pro-form">
                <div className="input-group">
                  <label>পুরো নাম</label>
                  <input name="name" defaultValue={myProfile.full_name} placeholder="আপনার নাম লিখুন" required />
                </div>
                
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem'}}>
                  <div className="input-group">
                    <label>রক্তের গ্রুপ</label>
                    <select name="bgroup" defaultValue={myProfile.blood_group}>
                      <option value="">নির্বাচন করুন</option>
                      {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>মোবাইল নম্বর</label>
                    <input name="phone" defaultValue={myProfile.phone} placeholder="০১৭XXXXXXXX" required />
                  </div>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem'}}>
                  <div className="input-group">
                    <label>শহর/এলাকা</label>
                    <input name="loc" defaultValue={myProfile.location} placeholder="উদা: ঢাকা" />
                  </div>
                  <div className="input-group">
                    <label>ডোনার স্ট্যাটাস</label>
                    <select name="status" defaultValue={myProfile.status}>
                      <option value="Active Donor">রক্ত দিতে প্রস্তুত</option>
                      <option value="Unavailable">ব্যস্ত আছি</option>
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label>বিস্তারিত ঠিকানা</label>
                  <input name="address" defaultValue={myProfile.address} placeholder="আপনার পূর্ণ ঠিকানা লিখুন" />
                </div>

                <div className="input-group">
                  <label>বায়ো/পরিচয়</label>
                  <textarea name="bio" defaultValue={myProfile.bio} placeholder="আপনার সম্পর্কে কিছু লিখুন..."></textarea>
                </div>

                <button type="submit" className="btn-primary" disabled={loading} style={{marginTop:'1rem'}}>
                  {loading ? 'সেভ হচ্ছে...' : 'প্রোফাইল সেভ করুন'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'live' && (
          <div className="feed-view animate-fade">
            <h2 className="section-title">লাইভ ব্লাড ফিড</h2>
            <div className="pro-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'1.5rem'}}>
              {requests.filter(r => r.status !== 'completed').map(req => (
                <div key={req.id} className="pro-req-card glass" style={{padding:'1.5rem'}}>
                  <div className="blood-badge" style={{marginBottom:'1rem'}}>{req.blood_group}</div>
                  <h3>{req.patient_name}</h3>
                  <p>📍 {req.location} | 📞 {req.phone}</p>
                  <div style={{display:'flex', gap:'0.5rem', marginTop:'1.5rem', flexWrap:'wrap'}}>
                    {req.status === 'pending' && <button className="btn-accept" onClick={() => supabase.from('blood_requests').update({status:'accepted', accepted_by: session.user.email}).eq('id', req.id)}>আমি দিব</button>}
                    <button className="btn-call" onClick={() => window.open(`tel:${req.phone}`)}>কল</button>
                    {(req.posted_by === session.user.email || isAdmin) && (
                      <>
                        <button className="btn-success" onClick={() => completeRequest(req.id)}>সফল</button>
                        <button className="btn-del-sm" onClick={() => deleteRequest(req.id)}>মুছুন</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'donors' && (
          <div className="donor-view animate-fade">
            <h2 className="section-title">রক্তদাতার তালিকা</h2>
            <div style={{display:'flex', gap:'1rem', marginBottom:'2rem'}}>
              <input placeholder="খুঁজুন..." className="glass" style={{flex:3, marginBottom:0, padding:'1rem'}} onChange={(e) => setSearchQuery(e.target.value.toLowerCase())} />
              <select className="glass" style={{flex:1, marginBottom:0, padding:'1rem'}} onChange={(e) => setFilterBG(e.target.value)}>
                <option value="All">সব গ্রুপ</option>
                {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>
            <div className="pro-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1.5rem'}}>
              {profiles.filter(p => (p.full_name?.toLowerCase().includes(searchQuery) || p.location?.toLowerCase().includes(searchQuery)) && (filterBG === 'All' || p.blood_group === filterBG)).map(p => (
                <div key={p.id} className="pro-donor-card glass" onClick={() => setSelectedUser(p)} style={{padding:'1.5rem', cursor:'pointer'}}>
                  <div className="donor-blood" style={{width:'50px', height:'50px', borderRadius:'12px', background:'var(--blood)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800', marginBottom:'1rem', color:'white'}}>{p.blood_group || '?'}</div>
                  <h3>{p.full_name}</h3>
                  <p>📍 {p.location || 'Unknown'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedUser && (
          <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
            <div className="pro-modal glass animate-fade" onClick={e => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setSelectedUser(null)}>✕</button>
              <div className="avatar-large">{selectedUser.blood_group || '?'}</div>
              <h2>{selectedUser.full_name}</h2>
              <div style={{textAlign:'left', margin:'2.5rem 0'}}>
                <p>📍 <strong>এলাকা:</strong> {selectedUser.location}</p>
                <p>🏠 <strong>ঠিকানা:</strong> {selectedUser.address}</p>
                <p>📞 <strong>ফোন:</strong> {selectedUser.phone}</p>
                <p>📝 <strong>বায়ো:</strong> {selectedUser.bio}</p>
              </div>
              <button className="btn-call" onClick={() => window.open(`tel:${selectedUser.phone}`)}>সরাসরি কল দিন</button>
            </div>
          </div>
        )}

        {activeTab === 'request' && (
          <div className="request-view animate-fade">
             <div className="glass form-container" style={{padding:'3rem'}}>
              <h2 style={{textAlign:'center', marginBottom:'2rem'}}>রক্তের আবেদন করুন</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                await supabase.from('blood_requests').insert([{ patient_name: fd.get('pname'), blood_group: fd.get('bgroup'), location: fd.get('loc'), phone: fd.get('phone'), posted_by: session.user.email, status: 'pending' }]);
                alert('আবেদন পোস্ট হয়েছে! 🩸'); setActiveTab('live');
              }}>
                <input name="pname" placeholder="রোগীর নাম" required />
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginTop:'1rem'}}>
                  <select name="bgroup" required><option value="">গ্রুপ</option>{bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}</select>
                  <input name="phone" placeholder="ফোন" required />
                </div>
                <input name="loc" placeholder="হাসপাতাল ও ঠিকানা" required style={{marginTop:'1rem'}} />
                <button type="submit" className="btn-primary" style={{marginTop:'1.5rem'}}>আবেদন পোস্ট করুন</button>
              </form>
            </div>
          </div>
        )}
      </main>

      <nav className="bottom-nav show-mobile">
        <li className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>🏠</li>
        <li className={activeTab === 'live' ? 'active' : ''} onClick={() => setActiveTab('live')}>🩸</li>
        <li className={activeTab === 'request' ? 'active' : ''} onClick={() => setActiveTab('request')}>📝</li>
        <li className={activeTab === 'donors' ? 'active' : ''} onClick={() => setActiveTab('donors')}>👥</li>
        <li className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>⚙️</li>
      </nav>
    </div>
  );
}

export default App;
