import en from '../en.json';
import fr from '../fr.json';
import he from '../he.json';

/**
 * Recursively gets all keys from a nested JSON object.
 * @param obj The JSON object.
 * @param prefix The current key prefix for recursion.
 * @returns An array of dot-notated key strings.
 */
function getAllKeys(obj: any, prefix = ''): string[] {
  return Object.keys(obj).reduce((res: string[], el) => {
    if (Array.isArray(obj[el])) {
      return res; // We don't care about the array content, just the key
    } else if (typeof obj[el] === 'object' && obj[el] !== null) {
      return [...res, ...getAllKeys(obj[el], prefix + el + '.')];
    }
    return [...res, prefix + el];
  }, []);
}

describe('i18n Consistency Check', () => {
  const enKeys = getAllKeys(en);

  test('fr.json should not be empty and should match en.json structure', () => {
    const frKeys = getAllKeys(fr);
    
    // Check if empty
    expect(frKeys.length).toBeGreaterThan(0);
    
    // Check for missing keys in French
    const missingInFr = enKeys.filter(key => !frKeys.includes(key));
    expect(missingInFr).toEqual([]);
    
    // Check for extra keys in French (not necessarily an error but good to know)
    const extraInFr = frKeys.filter(key => !enKeys.includes(key));
    expect(extraInFr).toEqual([]);
  });

  test('he.json should not be empty and should match en.json structure', () => {
    const heKeys = getAllKeys(he);
    
    // Check if empty
    expect(heKeys.length).toBeGreaterThan(0);
    
    // Check for missing keys in Hebrew
    const missingInHe = enKeys.filter(key => !heKeys.includes(key));
    expect(missingInHe).toEqual([]);
    
    // Check for extra keys in Hebrew
    const extraInHe = heKeys.length > 0 ? heKeys.filter(key => !enKeys.includes(key)) : [];
    expect(extraInHe).toEqual([]);
  });
});
