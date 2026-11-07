(() => {
  const KEY = 'daily-todo-tasks-v1';
  const $ = (selector) => document.querySelector(selector);
  const list = $('#task-list');
  const form = $('#task-form');
  const input = $('#task-input');
  const search = $('#search-input');
  const pages = {
    all: ['All tasks', 'A clear mind starts with a clear list.', 'Your tasks', 'Everything you need, all in one place.'],
    today: ['Today', 'Focus on what matters right now.', 'Today’s tasks', 'A little focus goes a long way.'],
    upcoming: ['Upcoming', 'There’s time for everything.', 'Coming up', 'Tasks scheduled for a later day.'],
    completed: ['Completed', 'Look how far you’ve come.', 'Done and dusted', 'Every finished task is a small win.'],
  };
  let tasks = loadTasks();
  let filter = 'all';
  let sortNewest = true;
  let toastTimer;

  function loadTasks() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(data) ? data.filter(t => t && typeof t.id === 'string' && typeof t.title === 'string') : [];
    } catch { return []; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(tasks)); }
  function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function formatDate(value) {
    if (!value) return 'No due date';
    const d = new Date(`${value}T12:00:00`);
    const current = todayKey();
    if (value === current) return 'Today';
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
    if (value === `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`) return 'Tomorrow';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function toast(message) {
    const node = $('#toast'); node.textContent = message; node.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 2200);
  }
  function render() {
    const done = tasks.filter(t => t.completed).length;
    const open = tasks.length - done;
    const today = todayKey();
    $('#all-count').textContent = open;
    $('#today-count').textContent = tasks.filter(t => !t.completed && t.due === today).length;
    $('#total-stat').textContent = tasks.length;
    $('#done-stat').textContent = done;
    $('#remaining-stat').textContent = open;
    const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    $('#done-caption').textContent = `${pct}%`;
    $('#done-progress').style.width = `${pct}%`;
    $('#progress-fill').style.width = `${pct}%`;
    $('#progress-text').textContent = `${done} of ${tasks.length} done`;
    const page = pages[filter];
    $('#breadcrumb-label').textContent = page[0];
    $('#page-title').innerHTML = `${page[0]}<span class="title-period">.</span>`;
    $('#page-subtitle').textContent = page[1];
    $('#list-heading').textContent = page[2];
    $('#list-description').textContent = page[3];
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));

    const query = search.value.trim().toLowerCase();
    let visible = tasks.filter(task => {
      const matchesFilter = filter === 'all' ? !task.completed : filter === 'completed' ? task.completed : filter === 'today' ? !task.completed && task.due === today : !task.completed && task.due && task.due > today;
      return matchesFilter && task.title.toLowerCase().includes(query);
    });
    visible.sort((a,b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.due && b.due && a.due !== b.due) return a.due.localeCompare(b.due);
      return sortNewest ? b.created - a.created : a.created - b.created;
    });
    list.replaceChildren(...visible.map(makeRow));
    $('#empty-state').hidden = visible.length > 0;
    $('#list-count').textContent = `Showing ${visible.length} ${visible.length === 1 ? 'task' : 'tasks'}`;
    $('#empty-title').textContent = query ? 'No matches found.' : filter === 'completed' ? 'Nothing completed yet.' : 'A fresh start.';
    $('#empty-copy').textContent = query ? 'Try another search or clear the search field.' : filter === 'completed' ? 'Finished tasks will show up here.' : 'Nothing on your list just yet. Add a task above and make it happen.';
  }
  function makeRow(task) {
    const row = document.createElement('article');
    row.className = `task-row${task.completed ? ' completed' : ''}`;
    const check = document.createElement('button'); check.className = 'check-button'; check.type = 'button'; check.setAttribute('aria-label', task.completed ? 'Mark task incomplete' : 'Complete task'); check.innerHTML = '<span>✓</span>';
    check.addEventListener('click', () => { task.completed = !task.completed; save(); render(); toast(task.completed ? 'Nice work — task completed.' : 'Task moved back to your list.'); });
    const info = document.createElement('div'); info.className = 'task-info';
    const title = document.createElement('div'); title.className = 'task-title'; title.textContent = task.title;
    const meta = document.createElement('div'); meta.className = 'task-meta';
    const due = document.createElement('span'); due.className = 'task-date'; due.textContent = task.due ? `◷ ${formatDate(task.due)}` : '◷ No due date'; meta.append(due);
    const priority = document.createElement('span'); priority.className = `priority priority-${task.priority || 'low'}`; priority.textContent = `${(task.priority || 'low')[0].toUpperCase()}${(task.priority || 'low').slice(1)} priority`; meta.append(priority);
    info.append(title, meta);
    const tools = document.createElement('div'); tools.className = 'task-tools';
    const select = document.createElement('select'); select.className = 'priority-select'; select.setAttribute('aria-label','Set priority');
    [['low','Low'],['medium','Medium'],['high','High']].forEach(([value,label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = (task.priority || 'low') === value; select.append(option); });
    select.addEventListener('change', () => { task.priority = select.value; save(); render(); });
    const edit = document.createElement('button'); edit.type='button'; edit.className='tool-button'; edit.textContent='✎'; edit.setAttribute('aria-label','Edit task'); edit.title='Edit task'; edit.addEventListener('click', () => editTask(task));
    const remove = document.createElement('button'); remove.type='button'; remove.className='tool-button'; remove.textContent='×'; remove.setAttribute('aria-label','Delete task'); remove.title='Delete task'; remove.addEventListener('click', () => { tasks = tasks.filter(t => t.id !== task.id); save(); render(); toast('Task deleted.'); });
    tools.append(select, edit, remove); row.append(check, info, tools); return row;
  }
  function editTask(task) {
    const next = window.prompt('Edit your task', task.title);
    if (next === null) return;
    const title = next.trim();
    if (!title) { toast('A task needs a name.'); return; }
    task.title = title; save(); render(); toast('Task updated.');
  }
  form.addEventListener('submit', event => {
    event.preventDefault(); const title = input.value.trim();
    if (!title) { input.focus(); return; }
    tasks.unshift({ id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`), title, created: Date.now(), due: $('#due-input').value, priority: 'low', completed: false });
    save(); input.value = ''; $('#due-input').value = ''; if (filter !== 'all') setFilter('all'); else render(); input.focus(); toast('Task added to your list.');
  });
  function setFilter(value) { filter = value; render(); }
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));
  search.addEventListener('input', render);
  $('#sort-button').addEventListener('click', () => { sortNewest = !sortNewest; $('#sort-label').textContent = sortNewest ? 'Date added' : 'Oldest first'; render(); });
  $('#clear-completed').addEventListener('click', () => {
    const before = tasks.length; tasks = tasks.filter(t => !t.completed);
    if (tasks.length !== before) { save(); render(); toast('Completed tasks cleared.'); } else toast('No completed tasks to clear.');
  });
  $('#theme-toggle').addEventListener('click', () => { document.body.classList.toggle('dark'); localStorage.setItem('daily-todo-dark', document.body.classList.contains('dark') ? '1' : '0'); });
  if (localStorage.getItem('daily-todo-dark') === '1') document.body.classList.add('dark');
  document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); search.focus(); } });
  const now = new Date();
  $('#today-date').textContent = now.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
  const hour = now.getHours(); $('#greeting').textContent = hour < 12 ? 'GOOD MORNING' : hour < 18 ? 'MAKE TODAY COUNT' : 'GOOD EVENING';
  render();
})();
