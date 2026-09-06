---
layout: default
title: Partners
permalink: /partners/
---

<section class="page-hero">
  <div class="container">
    <p class="eyebrow">Our Partners</p>
    <h1>Partners</h1>
    <p class="page-intro">
      We are grateful to the organizations and individuals who support
      the Rotary E-Club of All Star CAMANAVA in creating meaningful
      service and community impact.
    </p>
  </div>
</section>

<section class="partners-section">
  <div class="container">

    {% if site.data.partners.partners and site.data.partners.partners.size > 0 %}

      <div class="partners-grid">

        {% for partner in site.data.partners.partners %}

          {% assign partner_slug = partner.name
            | downcase
            | replace: " ", "-"
            | replace: "&", "and"
            | replace: "/", "-"
            | replace: ".", ""
            | replace: ",", ""
            | replace: "'", ""
          %}

          <a
            href="{{ '/partners/' | append: partner_slug | append: '/' | relative_url }}"
            class="partner-card"
          >

            {% if partner.logo and partner.logo != "" %}
              <div class="partner-logo">
                <img
                  src="{{ partner.logo | relative_url }}"
                  alt="{{ partner.name }}"
                  loading="lazy"
                >
              </div>
            {% endif %}

            <div class="partner-content">

              {% if partner.name and partner.name != "" %}
                <h2>{{ partner.name }}</h2>
              {% endif %}

              {% if partner.roles and partner.roles.size > 0 %}
                <div class="partner-roles">
                  {% for role in partner.roles %}
                    {% if role and role != "" %}
                      <span class="partner-role">{{ role }}</span>
                    {% endif %}
                  {% endfor %}
                </div>
              {% endif %}

              {% if partner.description and partner.description != "" %}
                <p>{{ partner.description }}</p>
              {% endif %}

              <span class="partner-link">
                View Details
                <span aria-hidden="true">→</span>
              </span>

            </div>

          </a>

        {% endfor %}

      </div>

    {% else %}

      <div class="partners-empty">
        <h2>Our Partners</h2>
        <p>
          We look forward to building partnerships with organizations
          that share our commitment to service and community.
        </p>
      </div>

    {% endif %}

  </div>
</section>