const format = (date: Date, formatStr: string, options?: any) => {
  if (formatStr.includes('dd MMMM')) {
    const months = [
      'янв', 'фев', 'мар', 'апр', 'май', 'июн',
      'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
    ];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }
  return date.toISOString();
};

const parseISO = (dateString: string) => new Date(dateString);

export { format, parseISO };