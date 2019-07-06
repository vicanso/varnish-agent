// Copyright 2019 tree xie
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package director

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDirector(t *testing.T) {
	t.Run("generate backend", func(t *testing.T) {
		assert := assert.New(t)
		backends := make([]Backend, 0)
		backends = append(backends, Backend{
			IP:   "127.0.0.1",
			Port: 3000,
		})
		backends = append(backends, Backend{
			IP:   "127.0.0.1",
			Port: 3001,
		})
		d := Director{}

		_, err := d.GetVclBackends()
		assert.Equal(errDirectorNameIsNil, err)

		d.Name = "aslant"
		vcl, err := d.GetVclBackends()
		assert.Nil(err)
		assert.Empty(vcl)

		d.Backends = backends
		vcl, err = d.GetVclBackends()
		assert.Equal(`backend aslant0 {
  .host = "127.0.0.1";
  .port = "3000";
  .connect_timeout = 3s;
  .first_byte_timeout = 5s;
  .between_bytes_timeout = 2s;
  .probe = basicProbe;
}
backend aslant1 {
  .host = "127.0.0.1";
  .port = "3001";
  .connect_timeout = 3s;
  .first_byte_timeout = 5s;
  .between_bytes_timeout = 2s;
  .probe = basicProbe;
}`, vcl)
		assert.Nil(err)
	})

	t.Run("generate init", func(t *testing.T) {
		assert := assert.New(t)
		backends := make([]Backend, 0)
		backends = append(backends, Backend{
			IP:   "127.0.0.1",
			Port: 3000,
		})
		backends = append(backends, Backend{
			IP:   "127.0.0.1",
			Port: 3001,
		})
		d := Director{}

		_, err := d.GetVclInit()
		assert.Equal(errDirectorNameIsNil, err)

		d.Name = "aslant"
		vcl, err := d.GetVclInit()
		assert.Nil(err)
		assert.Empty(vcl)

		d.Policy = policyHash
		d.Backends = backends
		_, err = d.GetVclInit()
		assert.Equal(err, errPolicyKeyIsNil)

		d.Policy = ""
		vcl, err = d.GetVclInit()
		assert.Nil(err)
		assert.Equal(`  new aslant = directors.round_robin();
  aslant.add_backend(aslant0);
  aslant.add_backend(aslant1);`, vcl)

		d.Policy = policyRandom
		vcl, err = d.GetVclInit()
		assert.Nil(err)
		assert.Equal(`  new aslant = directors.random();
  aslant.add_backend(aslant0, 1.0);
  aslant.add_backend(aslant1, 1.0);`, vcl)
	})

	generateDirectors := func() Directors {
		s := make(Directors, 0)
		s = append(s, &Director{
			Name: "apiBackend",
			Prefixs: []string{
				"/api",
				"/@api",
			},
			Backends: []Backend{
				Backend{
					IP:   "127.0.0.1",
					Port: 3001,
				},
				Backend{
					IP:   "127.0.0.1",
					Port: 3002,
				},
			},
		})
		s = append(s, &Director{
			Name: "aslantBackend",
			Hosts: []string{
				"aslant.site",
				"www.aslant.site",
			},
			Policy: policyFallback,
			Backends: []Backend{
				Backend{
					IP:   "127.0.0.1",
					Port: 3003,
				},
				Backend{
					IP:   "127.0.0.1",
					Port: 3004,
				},
			},
		})
		s = append(s, &Director{
			Name: "tinyBackend",
			Hosts: []string{
				"tiny.aslant.site",
			},
			Prefixs: []string{
				"/tiny",
				"/@tiny",
			},
			Policy: policyRandom,
			Backends: []Backend{
				Backend{
					IP:   "127.0.0.1",
					Port: 3005,
				},
				Backend{
					IP:   "127.0.0.1",
					Port: 3006,
				},
			},
		})
		s = append(s, &Director{
			Name:      "defaultBackend",
			Policy:    policyHash,
			PolicyKey: "req.http.cookie",
			Backends: []Backend{
				Backend{
					IP:   "127.0.0.1",
					Port: 3007,
				},
				Backend{
					IP:   "127.0.0.1",
					Port: 3008,
				},
			},
		})
		return s
	}

	t.Run("generate backend selector", func(t *testing.T) {
		assert := assert.New(t)
		s := generateDirectors()
		vcl, err := s.GetVclSelector()
		assert.Nil(err)
		assert.Equal(`if (req.http.host == "tiny.aslant.site" && (req.url ~ "^/tiny" || req.url ~ "^/@tiny")) {
  set req.backend_hint = tinyBackend.backend();
} else if ((req.http.host == "aslant.site" || req.http.host == "www.aslant.site")) {
  set req.backend_hint = aslantBackend.backend();
} else if ((req.url ~ "^/api" || req.url ~ "^/@api")) {
  set req.backend_hint = apiBackend.backend();
} else if (true) {
  set req.backend_hint = defaultBackend.backend(req.http.cookie);
}`, vcl)
	})

	t.Run("generate vcl", func(t *testing.T) {
		assert := assert.New(t)
		s := generateDirectors()
		vcl, err := s.GetVcl()
		assert.Nil(err)
		defaultVcl, err := assets.FindString(defaultFile)
		assert.Nil(err)
		assert.Equal(defaultVcl, vcl)
	})
}
