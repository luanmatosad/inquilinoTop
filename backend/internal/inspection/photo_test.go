package inspection_test

import (
	"bytes"
	"context"
	"io"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/inspection"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	jpegBytes = append([]byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0x00}, make([]byte, 64)...)
	pngBytes  = append([]byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, make([]byte, 64)...)
	webpBytes = append(append([]byte("RIFF"), 0x24, 0x00, 0x00, 0x00), []byte("WEBPVP8 ")...)
)

func (e *env) draftItem(t *testing.T) (*inspection.Detail, *inspection.Item) {
	t.Helper()
	d := e.create(t, inspection.TypeEntry, false)
	return d, e.item(t, d.ID, "Sala", "Piso", inspection.ConditionGood)
}

func (e *env) upload(d *inspection.Detail, it *inspection.Item, name string, data []byte) (*inspection.Photo, error) {
	return e.svc.UploadPhoto(context.Background(), d.ID, it.ID, e.org, e.user, name, bytes.NewReader(data))
}

func TestService_Photo_TiposPermitidos(t *testing.T) {
	e := newEnv()
	d, it := e.draftItem(t)
	for name, tc := range map[string]struct {
		data []byte
		mime string
	}{"a.jpg": {jpegBytes, "image/jpeg"}, "b.png": {pngBytes, "image/png"}, "c.webp": {webpBytes, "image/webp"}} {
		p, err := e.upload(d, it, name, tc.data)
		require.NoError(t, err, name)
		assert.Equal(t, tc.mime, p.MimeType)
		assert.Equal(t, len(tc.data), p.SizeBytes, "tamanho lido, não declarado")
	}
}

func TestService_Photo_ConteúdoPrecisaBaterComOTipo(t *testing.T) {
	e := newEnv()
	d, it := e.draftItem(t)
	for name, data := range map[string][]byte{
		"fake.jpg":  []byte("<html><script>alert(1)</script></html>"),
		"doc.pdf":   []byte("%PDF-1.4 conteudo"),
		"texto.png": []byte("isto nao e um png"),
		"gif.gif":   []byte("GIF89a\x01\x00\x01\x00"),
	} {
		_, err := e.upload(d, it, name, data)
		assert.ErrorIs(t, err, inspection.ErrInvalidPhoto, name)
	}
	_, err := e.upload(d, it, "vazio.jpg", nil)
	assert.ErrorIs(t, err, inspection.ErrInvalidPhoto)
	assert.Empty(t, e.storage.files, "nada é gravado em disco")
}

func TestService_Photo_Tamanho(t *testing.T) {
	e := newEnv()
	d, it := e.draftItem(t)
	big := append([]byte{0xFF, 0xD8, 0xFF}, make([]byte, inspection.MaxPhotoBytes)...) // 10 MB + 3 bytes
	_, err := e.upload(d, it, "grande.jpg", big)
	assert.ErrorIs(t, err, inspection.ErrPhotoTooLarge)

	exact := append([]byte{0xFF, 0xD8, 0xFF}, make([]byte, inspection.MaxPhotoBytes-3)...)
	_, err = e.upload(d, it, "limite.jpg", exact)
	assert.NoError(t, err, "exatamente 10 MB é aceito")
}

func TestService_Photo_LimitePorItem(t *testing.T) {
	e := newEnv()
	d, it := e.draftItem(t)
	for i := 0; i < inspection.MaxPhotosPerItem; i++ {
		_, err := e.upload(d, it, "f.jpg", jpegBytes)
		require.NoError(t, err)
	}
	_, err := e.upload(d, it, "extra.jpg", jpegBytes)
	assert.ErrorIs(t, err, inspection.ErrPhotoLimit)

	other := e.item(t, d.ID, "Cozinha", "Pia", inspection.ConditionGood)
	_, err = e.upload(d, other, "f.jpg", jpegBytes)
	assert.NoError(t, err, "o limite é por item")
}

func TestService_Photo_NomeSanitizado(t *testing.T) {
	e := newEnv()
	d, it := e.draftItem(t)
	p, err := e.upload(d, it, "../../etc/passwd.jpg", jpegBytes)
	require.NoError(t, err)
	assert.Equal(t, "passwd.jpg", p.Filename)
	p, err = e.upload(d, it, `C:\fotos\sala.png`, pngBytes)
	require.NoError(t, err)
	assert.Equal(t, "sala.png", p.Filename)
	for path := range e.storage.files {
		assert.NotContains(t, path, "..")
	}
}

func TestService_Photo_ArmazenaPorOrganização(t *testing.T) {
	e := newEnv()
	d, it := e.draftItem(t)
	_, err := e.upload(d, it, "a.jpg", jpegBytes)
	require.NoError(t, err)
	require.Len(t, e.storage.dirs, 1)
	assert.Equal(t, e.org, e.storage.dirs[0], "pasta da organização, não do usuário")
}

func TestService_Photo_OutraOrganização(t *testing.T) {
	e := newEnv()
	d, it := e.draftItem(t)
	_, err := e.svc.UploadPhoto(context.Background(), d.ID, it.ID, uuid.New(), e.user, "a.jpg", bytes.NewReader(jpegBytes))
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

func TestService_Photo_ItemDeOutroLaudo(t *testing.T) {
	e := newEnv()
	d, _ := e.draftItem(t)
	other := e.create(t, inspection.TypeExit, false)
	foreign := e.item(t, other.ID, "Sala", "Piso", inspection.ConditionGood)
	_, err := e.upload(d, foreign, "a.jpg", jpegBytes)
	assert.ErrorIs(t, err, apierr.ErrNotFound, "o item precisa ser do laudo informado")
}

func TestService_Photo_LaudoConcluído(t *testing.T) {
	e := newEnv()
	d, it := e.draftItem(t)
	p, err := e.upload(d, it, "a.jpg", jpegBytes)
	require.NoError(t, err)
	_, err = e.svc.Complete(context.Background(), d.ID, e.org, e.user)
	require.NoError(t, err)

	_, err = e.upload(d, it, "b.jpg", jpegBytes)
	assert.ErrorIs(t, err, inspection.ErrNotEditable)
	assert.ErrorIs(t, e.svc.DeletePhoto(context.Background(), p.ID, it.ID, d.ID, e.org), inspection.ErrNotEditable)

	rc, got, err := e.svc.OpenPhoto(context.Background(), p.ID, e.org)
	require.NoError(t, err, "leitura continua permitida")
	defer rc.Close()
	assert.Equal(t, "image/jpeg", got.MimeType)
}

func TestService_Photo_RemoçãoLógicaEDetalhe(t *testing.T) {
	e := newEnv()
	d, it := e.draftItem(t)
	p, err := e.upload(d, it, "a.jpg", jpegBytes)
	require.NoError(t, err)

	got, err := e.svc.Get(context.Background(), d.ID, e.org)
	require.NoError(t, err)
	require.Len(t, got.Items[0].Photos, 1)
	assert.Equal(t, p.ID, got.Items[0].Photos[0].ID)

	require.NoError(t, e.svc.DeletePhoto(context.Background(), p.ID, it.ID, d.ID, e.org))
	got, _ = e.svc.Get(context.Background(), d.ID, e.org)
	assert.Empty(t, got.Items[0].Photos)
	assert.NotNil(t, got.Items[0].Photos, "fotos nunca nil")
	_, _, err = e.svc.OpenPhoto(context.Background(), p.ID, e.org)
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	assert.ErrorIs(t, e.svc.DeletePhoto(context.Background(), p.ID, it.ID, d.ID, e.org), apierr.ErrNotFound)
}

func TestService_Photo_AbrirConteúdo(t *testing.T) {
	e := newEnv()
	d, it := e.draftItem(t)
	p, err := e.upload(d, it, "a.png", pngBytes)
	require.NoError(t, err)
	rc, _, err := e.svc.OpenPhoto(context.Background(), p.ID, e.org)
	require.NoError(t, err)
	defer rc.Close()
	b, _ := io.ReadAll(rc)
	assert.Equal(t, pngBytes, b)

	_, _, err = e.svc.OpenPhoto(context.Background(), p.ID, uuid.New())
	assert.ErrorIs(t, err, apierr.ErrNotFound, "outra organização não lê")
}
