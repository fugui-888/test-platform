const getSavedSymbolsFromStorage = () => {
  const data = localStorage.getItem('savedSymbols');

  return data ? (JSON.parse(data).split(',') as string[]) : [];
};

export default getSavedSymbolsFromStorage;
