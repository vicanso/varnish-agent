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
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/gobuffalo/packr/v2"
)

const (
	policyRoundRobin = "round_robin"
	policyFallback   = "fallback"
	policyRandom     = "random"
	policyHash       = "hash"

	templetFile = "template.vcl"
	defaultFile = "default.vcl"

	defaultConnectTimeout      = 3
	defaultFirstByteTimeout    = 5
	defaultBetweenBytesTimeout = 2

	backendTemplate = `backend %s {
  .host = "%s";
  .port = "%d";
  .connect_timeout = %ds;
  .first_byte_timeout = %ds;
  .between_bytes_timeout = %ds;
  .probe = basicProbe;
}`
)

type (
	// Director director
	Director struct {
		Name                string    `json:"name,omitempty" yaml:"-"`
		Hosts               []string  `json:"hosts,omitempty" yaml:"hosts,omitempty"`
		Prefixs             []string  `json:"prefixs,omitempty" yaml:"prefixs,omitempty"`
		Backends            []Backend `json:"backends,omitempty" yaml:"backends,omitempty"`
		ConnectTimeout      int       `json:"connectTimeout,omitempty" yaml:"connectTimeout,omitempty"`
		FirstByteTimeout    int       `json:"firstByteTimeout,omitempty" yaml:"firstByteTimeout,omitempty"`
		BetweenBytesTimeout int       `json:"betweenBytesTimeout,omitempty" yaml:"betweenBytesTimeout,omitempty"`
		Policy              string    `json:"policy,omitempty" yaml:"policy,omitempty"`
		PolicyKey           string    `json:"policyKey,omitempty" yaml:"policyKey,omitempty"`
		priority            int
	}
	// Backend backend
	Backend struct {
		IP   string `json:"ip,omitempty" yaml:"ip,omitempty"`
		Port int    `json:"port,omitempty" yaml:"port,omitempty"`
	}
	// Directors director list
	Directors []*Director
)

var (
	errDirectorNameIsNil = errors.New("director's name can't be nil")
	errIPAndPortIsNill   = errors.New("IP and port can't be nil")
	errPolicyKeyIsNil    = errors.New("Policy key can't be nil")

	assets = packr.New("assets", "../assets")
)

func (d *Director) validate() error {
	if d.Name == "" {
		return errDirectorNameIsNil
	}
	if d.Policy == policyHash && d.PolicyKey == "" {
		return errPolicyKeyIsNil
	}
	return nil
}

// GetVclBackends get backends vcl
func (d *Director) GetVclBackends() (vcl string, err error) {
	err = d.validate()
	if err != nil {
		return
	}
	if len(d.Backends) == 0 {
		return
	}

	connectTimeout := d.ConnectTimeout
	if connectTimeout <= 0 {
		connectTimeout = defaultConnectTimeout
	}

	firstByteTimeout := d.FirstByteTimeout
	if firstByteTimeout <= 0 {
		firstByteTimeout = defaultFirstByteTimeout
	}

	betweenBytesTimeout := d.BetweenBytesTimeout
	if betweenBytesTimeout <= 0 {
		betweenBytesTimeout = defaultBetweenBytesTimeout
	}

	result := make([]string, 0)
	for index, backend := range d.Backends {
		if backend.IP == "" || backend.Port == 0 {
			err = errIPAndPortIsNill
			return
		}
		name := fmt.Sprintf("%s%d", d.Name, index)
		v := fmt.Sprintf(backendTemplate, name, backend.IP, backend.Port, connectTimeout, firstByteTimeout, betweenBytesTimeout)
		result = append(result, v)
	}
	vcl = strings.Join(result, "\n")
	return
}

// GetVclInit get init vcl
func (d *Director) GetVclInit() (vcl string, err error) {
	err = d.validate()
	if err != nil {
		return
	}
	if len(d.Backends) == 0 {
		return
	}
	policy := d.Policy
	if policy == "" {
		policy = policyRoundRobin
	}
	result := make([]string, 0)
	result = append(result, fmt.Sprintf("  new %s = directors.%s();", d.Name, policy))
	for index := range d.Backends {
		name := fmt.Sprintf("%s%d", d.Name, index)
		if policy == policyRandom || policy == policyHash {
			result = append(result, fmt.Sprintf("  %s.add_backend(%s, 1.0);", d.Name, name))
		} else {
			result = append(result, fmt.Sprintf("  %s.add_backend(%s);", d.Name, name))
		}
	}
	vcl = strings.Join(result, "\n")
	return
}

func (s Directors) Len() int {
	return len(s)
}

func (s Directors) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

func (s Directors) Less(i, j int) bool {
	return s[i].priority < s[j].priority
}

// GetVclSelector get selector vcl
func (s Directors) GetVclSelector() (vcl string, err error) {
	// 如果没有director直接返回
	if len(s) == 0 {
		return
	}
	for _, d := range s {
		err = d.validate()
		if err != nil {
			return
		}
		priority := 8
		if len(d.Hosts) != 0 {
			priority -= 4
		}
		if len(d.Prefixs) != 0 {
			priority -= 2
		}
		d.priority = priority
	}
	sort.Sort(s)
	result := make([]string, 0)
	for index, d := range s {

		conditions := make([]string, 0)
		if len(d.Hosts) != 0 {
			arr := make([]string, 0)
			for _, host := range d.Hosts {
				arr = append(arr, fmt.Sprintf(`req.http.host == "%s"`, host))
			}
			if len(arr) > 1 {
				conditions = append(conditions, "("+strings.Join(arr, " || ")+")")
			} else {
				conditions = append(conditions, arr[0])
			}
		}

		if len(d.Prefixs) != 0 {
			arr := make([]string, 0)
			for _, prefix := range d.Prefixs {
				arr = append(arr, fmt.Sprintf(`req.url ~ "^%s"`, prefix))
			}
			if len(arr) > 1 {
				conditions = append(conditions, "("+strings.Join(arr, " || ")+")")
			} else {
				conditions = append(conditions, arr[0])
			}
		}

		conditionDesc := ""
		if index == 0 {
			conditionDesc += "if "
		} else {
			conditionDesc += "} else if "
		}

		if len(conditions) != 0 {
			conditionDesc += ("(" + strings.Join(conditions, " && ") + ")")
		} else {
			conditionDesc += ("(true)")
		}
		conditionDesc += " {\n"
		conditionDesc += fmt.Sprintf("  set req.backend_hint = %s.backend(%s);", d.Name, d.PolicyKey)
		result = append(result, conditionDesc)
	}
	result = append(result, "}")
	vcl = strings.Join(result, "\n")
	return
}

// GetVcl get vcl of varnish
func (s Directors) GetVcl() (vcl string, err error) {
	template, err := assets.FindString(templetFile)
	if err != nil {
		return
	}
	backendList := make([]string, 0)
	initList := make([]string, 0)
	for _, d := range s {
		backend, e := d.GetVclBackends()
		if e != nil {
			err = e
			return
		}
		init, e := d.GetVclInit()
		if e != nil {
			err = e
			return
		}

		if backend != "" {
			backendList = append(backendList, backend)
		}
		if init != "" {
			initList = append(initList, init)
		}
	}

	template = strings.Replace(template, "### BACKEND LIST ###", strings.Join(backendList, "\n"), 1)

	template = strings.Replace(template, "### INIT ###", strings.Join(initList, "\n"), 1)

	selector, err := s.GetVclSelector()
	if err != nil {
		return
	}
	arr := strings.Split(selector, "\n")
	for index, value := range arr {
		arr[index] = "  " + value
	}
	selector = strings.Join(arr, "\n")
	vcl = strings.Replace(template, "### BACKEND SELECT ###", selector, 1)

	return
}
