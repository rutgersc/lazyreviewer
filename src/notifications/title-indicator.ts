const DEFAULT_TITLE = 'LazyReviewer';

let unreadCount = 0;

export const incrementUnreadCount = (delta: number) => {
  unreadCount += delta;
  updateTitle();
};

export const clearUnreadCount = () => {
  unreadCount = 0;
  updateTitle();
};

const updateTitle = () => {
  if (unreadCount > 0) {
    process.title = `(${unreadCount}) ${DEFAULT_TITLE}`;
  } else {
    process.title = DEFAULT_TITLE;
  }
};

// Initialize title
process.title = DEFAULT_TITLE;
