import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, openSync, readSync, closeSync, statSync } from 'node:fs'
import { PMTiles } from 'pmtiles'
import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'

test('single PMTiles archive contains precise raw OSM building parts and height provenance', async () => {
  const data = JSON.parse(readFileSync(new URL('../src/domain/osm-buildings-data.json', import.meta.url)))
  const path = new URL('../public/data/dublin-buildings.pmtiles', import.meta.url)
  assert.equal(statSync(path).size, data.bytes)
  assert(data.stats.source_geometries > 600000 && data.stats.part > 3000)
  const fd=openSync(path,'r')
  try {
    const archive=new PMTiles({getKey:()=>path.href, getBytes:async(offset,length)=>{const b=new Uint8Array(length);const actual=readSync(fd,b,0,length,offset);return {data:b.buffer.slice(0,actual)}}})
    const header=await archive.getHeader(), meta=await archive.getMetadata()
    assert.equal(header.maxZoom,16); assert.equal(header.minZoom,14)
    assert.equal(meta.license,'ODbL 1.0')
    const tile=await archive.getZxy(16,31628,21243)
    const layer=new VectorTile(new PbfReader(new Uint8Array(tile.data))).layers.buildings
    const features=Array.from({length:layer.length},(_,i)=>layer.feature(i).properties)
    assert(features.some(p=>p.name==='Campanile' && p.height===30.5 && p.height_source==='osm_height' && p.render===0))
    assert.equal(features.filter(p=>p.parent_id==='w44075420' && p.role==='part').length,9)
    assert(features.some(p=>p.parent_id==='w44075420' && p.roof_shape==='dome' && p.base>0))
    assert(features.some(p=>p.role==='part' && p.render===1))
    assert(features.some(p=>p.height_source==='estimated' && p.height>p.base))
    assert(features.some(p=>p.roof_shape==='gabled'))
    assert(features.every(p=>p.height>p.base))
  } finally {closeSync(fd)}
})
