const { Client } = require('@elastic/elasticsearch');

const client = new Client({
    node: 'http://localhost:9200',
    auth: {
        username: 'elastic', // Kullanıcı adı
        password: 'your_password_here' // Şifre
    }
});


// OCR sonuçlarını kaydetme
export async function saveOCRResult(fileId, fileName, text, highlights = []) {
    try {
        await client.index({
            index: 'ocr_results',
            id: fileId,
            document: {
                fileName,
                text,
                highlights,
                timestamp: new Date(),
            }
        });
        return true;
    } catch (error) {
        console.error('Elasticsearch kayıt hatası:', error);
        return false;
    }
}

// OCR sonuçlarını getirme
export async function getOCRResult(fileId) {
    try {
        const result = await client.get({
            index: 'ocr_results',
            id: fileId
        });
        return result._source;
    } catch (error) {
        console.error('Elasticsearch okuma hatası:', error);
        return null;
    }
}

// OCR sonuçlarını arama
export async function searchOCRResults(query) {
    try {
        const result = await client.search({
            index: 'ocr_results',
            query: {
                multi_match: {
                    query,
                    fields: ['fileName', 'text']
                }
            }
        });
        return result.hits.hits.map(hit => ({
            id: hit._id,
            ...hit._source
        }));
    } catch (error) {
        console.error('Elasticsearch arama hatası:', error);
        return [];
    }
}

// İşaretlemeleri güncelleme
export async function updateHighlights(fileId, highlights) {
    try {
        await client.update({
            index: 'ocr_results',
            id: fileId,
            doc: {
                highlights
            }
        });
        return true;
    } catch (error) {
        console.error('Elasticsearch güncelleme hatası:', error);
        return false;
    }
}











