import React, { useState, useEffect, useRef } from 'react';
import { Droplets, Sun, Moon, Calendar, Sparkles, CheckCircle2, Circle, Send, RefreshCw, Plus, Edit2, Trash2, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';

let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (e) {
  console.error("Failed to initialize GoogleGenAI", e);
}

type Category = 'morning' | 'evening' | 'weekly';

interface Task {
  id: string;
  title: string;
  description?: string;
  category: Category;
  completed: boolean;
  dayOfWeek?: number;
}

const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'غسل الوجه بالغسول المناسب', description: 'استخدم غسولاً لطيفاً يناسب نوع بشرتك، ودلكه بحركات دائرية لمدة 60 ثانية.', category: 'morning', completed: false },
  { id: '2', title: 'تفريش الأسنان (دقيقتين)', description: 'استخدم معجون أسنان يحتوي على الفلورايد، وفرش أسنانك بحركات دائرية لطيفة لمدة دقيقتين كاملتين.', category: 'morning', completed: false },
  { id: '3', title: 'استخدام مزيل العرق', category: 'morning', completed: false },
  { id: '4', title: 'تمشيط الشعر وترتيبه', category: 'morning', completed: false },
  { id: '5', title: 'الاستحمام', category: 'morning', completed: false },
  { id: '6', title: 'تفريش الأسنان', category: 'evening', completed: false },
  { id: '7', title: 'غسل الوجه وإزالة الأوساخ/المكياج', description: 'تأكد من إزالة جميع آثار المكياج وواقي الشمس قبل النوم لتجنب انسداد المسام.', category: 'evening', completed: false },
  { id: '8', title: 'ترطيب البشرة', description: 'استخدم مرطباً ليلياً مناسباً لبشرتك للحفاظ على ترطيبها أثناء النوم.', category: 'evening', completed: false },
  { id: '9', title: 'قص وتقليم الأظافر', category: 'weekly', dayOfWeek: 5, completed: false },
  { id: '10', title: 'تغيير أغطية السرير والوسائد', description: 'يساعد تغيير الأغطية أسبوعياً في تقليل تراكم البكتيريا وخلايا الجلد الميتة، مما يحسن صحة البشرة.', category: 'weekly', dayOfWeek: 6, completed: false },
  { id: '11', title: 'غسل مناشف الحمام', category: 'weekly', dayOfWeek: 6, completed: false },
  { id: '12', title: 'تنظيف أدوات العناية الشخصية', description: 'نظف فرش الشعر، وأدوات الحلاقة، وفرش المكياج لمنع تراكم البكتيريا.', category: 'weekly', dayOfWeek: 0, completed: false },
];

const DAYS_OF_WEEK = [
  { id: 0, name: 'الأحد' },
  { id: 1, name: 'الإثنين' },
  { id: 2, name: 'الثلاثاء' },
  { id: 3, name: 'الأربعاء' },
  { id: 4, name: 'الخميس' },
  { id: 5, name: 'الجمعة' },
  { id: 6, name: 'السبت' },
];

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [activeTab, setActiveTab] = useState<'routine' | 'ai'>('routine');
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'model',
    text: 'مرحباً! أنا مساعدك الشخصي للعناية والنظافة. كيف يمكنني مساعدتك اليوم؟'
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Customization states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalCategory, setModalCategory] = useState<Category>('morning');
  const [taskTitleInput, setTaskTitleInput] = useState('');
  const [taskDescriptionInput, setTaskDescriptionInput] = useState('');
  const [taskDayInput, setTaskDayInput] = useState<number>(new Date().getDay());
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

  useEffect(() => {
    const today = new Date().toDateString();
    const lastLogin = localStorage.getItem('hygiene_last_login');
    const savedTasks = localStorage.getItem('hygiene_tasks');
    
    if (savedTasks) {
      let parsedTasks = JSON.parse(savedTasks);
      
      // Migration for older tasks without dayOfWeek
      parsedTasks = parsedTasks.map((t: Task) => {
        if (t.category === 'weekly' && t.dayOfWeek === undefined) {
          const initial = INITIAL_TASKS.find(it => it.id === t.id);
          return { ...t, dayOfWeek: initial?.dayOfWeek ?? 5 };
        }
        return t;
      });

      if (lastLogin !== today) {
        parsedTasks = parsedTasks.map((t: Task) => 
          (t.category === 'morning' || t.category === 'evening') ? { ...t, completed: false } : t
        );
        localStorage.setItem('hygiene_last_login', today);
      }
      setTasks(parsedTasks);
    } else {
      localStorage.setItem('hygiene_last_login', today);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('hygiene_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const resetWeekly = () => {
    setTasks(tasks.map(t => t.category === 'weekly' ? { ...t, completed: false } : t));
  };

  const handleOpenAddModal = (category: Category) => {
    setModalCategory(category);
    setEditingTask(null);
    setTaskTitleInput('');
    setTaskDescriptionInput('');
    setTaskDayInput(category === 'weekly' ? selectedDay : new Date().getDay());
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task: Task) => {
    setModalCategory(task.category);
    setEditingTask(task);
    setTaskTitleInput(task.title);
    setTaskDescriptionInput(task.description || '');
    setTaskDayInput(task.dayOfWeek ?? new Date().getDay());
    setIsModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitleInput.trim()) return;

    if (editingTask) {
      setTasks(tasks.map(t => t.id === editingTask.id ? { 
        ...t, 
        title: taskTitleInput.trim(),
        description: taskDescriptionInput.trim(),
        dayOfWeek: modalCategory === 'weekly' ? taskDayInput : undefined
      } : t));
    } else {
      const newTask: Task = {
        id: Date.now().toString(),
        title: taskTitleInput.trim(),
        description: taskDescriptionInput.trim(),
        category: modalCategory,
        completed: false,
        dayOfWeek: modalCategory === 'weekly' ? taskDayInput : undefined
      };
      setTasks([...tasks, newTask]);
    }
    setIsModalOpen(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userText = input.trim();
    const newMessages: ChatMessage[] = [...messages, { role: 'user', text: userText }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      if (!ai) {
        throw new Error("عذراً، مفتاح API الخاص بـ Gemini غير متوفر. يرجى إضافته في إعدادات Vercel (Environment Variables) لكي يعمل المساعد الذكي.");
      }
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: newMessages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction: 'أنت مساعد خبير في النظافة الشخصية والعناية بالبشرة والجسم. أجب باللغة العربية بأسلوب ودود ومختصر ومفيد. قدم نصائح عملية وقابلة للتطبيق.',
        }
      });
      setMessages([...newMessages, { role: 'model', text: response.text || '' }]);
    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { role: 'model', text: 'عذراً، حدث خطأ أثناء الاتصال بالمساعد. يرجى المحاولة لاحقاً.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const morningTasks = tasks.filter(t => t.category === 'morning');
  const eveningTasks = tasks.filter(t => t.category === 'evening');
  const weeklyTasks = tasks.filter(t => t.category === 'weekly' && t.dayOfWeek === selectedDay);

  const dailyProgress = Math.round((tasks.filter(t => (t.category === 'morning' || t.category === 'evening') && t.completed).length / (morningTasks.length + eveningTasks.length)) * 100) || 0;

  return (
    <div className="min-h-screen bg-teal-50 text-teal-950 font-sans pb-20 md:pb-0">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-teal-100 p-2 rounded-xl text-teal-600">
              <Droplets className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-teal-800">نظافتي</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-teal-600">إنجاز اليوم</div>
            <div className="w-12 h-12 rounded-full border-4 border-teal-100 flex items-center justify-center relative">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-teal-500 transition-all duration-500 ease-out"
                  strokeDasharray={`${dailyProgress}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
              </svg>
              <span className="text-xs font-bold">{dailyProgress}%</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex bg-white rounded-2xl p-1 shadow-sm mb-6">
          <button
            onClick={() => setActiveTab('routine')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors ${activeTab === 'routine' ? 'bg-teal-500 text-white shadow-sm' : 'text-teal-600 hover:bg-teal-50'}`}
          >
            الروتين
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors ${activeTab === 'ai' ? 'bg-teal-500 text-white shadow-sm' : 'text-teal-600 hover:bg-teal-50'}`}
          >
            المساعد الذكي
          </button>
        </div>

        {activeTab === 'routine' ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            {/* Morning Routine */}
            <section className="bg-white rounded-3xl p-5 shadow-sm border border-teal-100/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                    <Sun className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">الروتين الصباحي</h2>
                </div>
                <button onClick={() => handleOpenAddModal('morning')} className="text-teal-600 hover:bg-teal-50 p-2 rounded-lg transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {morningTasks.map(task => (
                    <TaskItem key={task.id} task={task} onToggle={() => toggleTask(task.id)} onEdit={() => handleOpenEditModal(task)} onDelete={() => setTaskToDelete(task.id)} />
                  ))}
                </AnimatePresence>
              </div>
            </section>

            {/* Evening Routine */}
            <section className="bg-white rounded-3xl p-5 shadow-sm border border-teal-100/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                    <Moon className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">الروتين المسائي</h2>
                </div>
                <button onClick={() => handleOpenAddModal('evening')} className="text-teal-600 hover:bg-teal-50 p-2 rounded-lg transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {eveningTasks.map(task => (
                    <TaskItem key={task.id} task={task} onToggle={() => toggleTask(task.id)} onEdit={() => handleOpenEditModal(task)} onDelete={() => setTaskToDelete(task.id)} />
                  ))}
                </AnimatePresence>
              </div>
            </section>

            {/* Weekly Routine */}
            <section className="bg-white rounded-3xl p-5 shadow-sm border border-teal-100/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-teal-100 p-2 rounded-lg text-teal-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">المهام الأسبوعية</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={resetWeekly} className="text-xs flex items-center gap-1 text-teal-600 hover:text-teal-800 bg-teal-50 px-2 py-1 rounded-md transition-colors">
                    <RefreshCw className="w-3 h-3" />
                    إعادة تعيين
                  </button>
                  <button onClick={() => handleOpenAddModal('weekly')} className="text-teal-600 hover:bg-teal-50 p-1.5 rounded-lg transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex overflow-x-auto gap-2 pb-2 mb-4 hide-scrollbar">
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day.id}
                    onClick={() => setSelectedDay(day.id)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      selectedDay === day.id 
                        ? 'bg-teal-500 text-white shadow-sm' 
                        : 'bg-slate-50 text-slate-600 hover:bg-teal-50'
                    }`}
                  >
                    {day.name}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {weeklyTasks.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6 text-slate-400 text-sm">
                      لا توجد مهام مجدولة لهذا اليوم
                    </motion.div>
                  ) : (
                    weeklyTasks.map(task => (
                      <TaskItem key={task.id} task={task} onToggle={() => toggleTask(task.id)} onEdit={() => handleOpenEditModal(task)} onDelete={() => setTaskToDelete(task.id)} />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </section>

          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-sm border border-teal-100/50 overflow-hidden flex flex-col h-[600px] max-h-[70vh]">
            <div className="bg-teal-500 text-white p-4 flex items-center gap-3">
              <Sparkles className="w-5 h-5" />
              <div>
                <h2 className="font-bold">مساعد النظافة الذكي</h2>
                <p className="text-teal-100 text-xs">اسألني عن أي شيء يخص العناية الشخصية</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-teal-500 text-white rounded-tl-none' 
                      : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tr-none'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-slate-500 shadow-sm border border-slate-100 rounded-2xl rounded-tr-none p-4 flex gap-1">
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 bg-teal-300 rounded-full" />
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-teal-300 rounded-full" />
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-teal-300 rounded-full" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اسأل عن روتين العناية بالبشرة..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                disabled={isLoading}
              />
              <button 
                type="submit" 
                disabled={isLoading || !input.trim()}
                className="bg-teal-500 text-white p-2.5 rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Send className="w-5 h-5 rtl:-scale-x-100" />
              </button>
            </form>
          </motion.div>
        )}
      </main>

      {/* Add/Edit Task Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-800">
                  {editingTask ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSaveTask} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">اسم المهمة</label>
                  <input
                    type="text"
                    value={taskTitleInput}
                    onChange={(e) => setTaskTitleInput(e.target.value)}
                    placeholder="مثال: شرب كوب من الماء"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الوصف أو التعليمات (اختياري)</label>
                  <textarea
                    value={taskDescriptionInput}
                    onChange={(e) => setTaskDescriptionInput(e.target.value)}
                    placeholder="أضف تفاصيل أو خطوات للمهمة..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm min-h-[80px] resize-y"
                  />
                </div>
                {modalCategory === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">اليوم</label>
                    <select
                      value={taskDayInput}
                      onChange={(e) => setTaskDayInput(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none"
                    >
                      {DAYS_OF_WEEK.map(day => (
                        <option key={day.id} value={day.id}>{day.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={!taskTitleInput.trim()} className="flex-1 bg-teal-500 text-white py-2.5 rounded-xl font-medium hover:bg-teal-600 transition-colors disabled:opacity-50">
                    حفظ
                  </button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl font-medium hover:bg-slate-200 transition-colors">
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {taskToDelete && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-5 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-500 mx-auto flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-800 mb-2">حذف المهمة</h3>
              <p className="text-slate-500 text-sm mb-6">هل أنت متأكد من رغبتك في حذف هذه المهمة؟ لا يمكن التراجع عن هذا الإجراء.</p>
              <div className="flex gap-2">
                <button onClick={() => { setTasks(tasks.filter(t => t.id !== taskToDelete)); setTaskToDelete(null); }} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium hover:bg-red-600 transition-colors">
                  حذف
                </button>
                <button onClick={() => setTaskToDelete(null)} className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl font-medium hover:bg-slate-200 transition-colors">
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TaskItem({ task, onToggle, onEdit, onDelete }: { task: Task, onToggle: () => void, onEdit: () => void, onDelete: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDescription = !!task.description?.trim();

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`flex flex-col gap-2 p-3 rounded-xl transition-all group ${
        task.completed ? 'bg-teal-50/50 opacity-75' : 'bg-slate-50 hover:bg-teal-50/30'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => hasDescription ? setIsExpanded(!isExpanded) : onToggle()}>
          <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className={`flex-shrink-0 transition-colors ${task.completed ? 'text-teal-500' : 'text-slate-300 hover:text-teal-400'}`}>
            {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
          </button>
          <div className="flex-1 flex items-center gap-2">
            <span className={`text-sm font-medium transition-all ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
              {task.title}
            </span>
            {hasDescription && (
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {isExpanded && hasDescription && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pl-2 pr-9 pb-1 text-sm text-slate-500 whitespace-pre-wrap border-t border-slate-100/50 pt-2 mt-1">
              {task.description}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
